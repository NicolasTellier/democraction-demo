import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {gridCellLabel, gridCellStyle, validateGrid, loadGrid} from '../app/insee-grid.js';

const manifest = JSON.parse(readFileSync(new URL('../data/insee-grid/manifest.json', import.meta.url)));
const territory = JSON.parse(readFileSync(new URL('../data/territoire-33-11-2026.json', import.meta.url)));

test('les 87 communes disposent du vrai carroyage Insee aux deux résolutions', () => {
  assert.equal(territory.communes.length, 87);
  assert.equal(manifest.millesime, 2021);
  assert.match(manifest.tileSource, /^https:\/\/tiles\.insee\.fr\//);
  const unique = {200: new Set(), 1000: new Set()};
  for (const resolution of [200, 1000]) {
    for (const commune of territory.communes) {
      const code = commune.codeInsee;
      const contents = gunzipSync(readFileSync(new URL(`../data/insee-grid/${code}.json.gz`, import.meta.url)));
      const data = JSON.parse(contents);
      const cells = validateGrid(data, resolution, code);
      assert.ok(cells.length > 0, `${code}: ${resolution} m`);
      for (const cell of cells) {
        unique[resolution].add(cell.properties.id);
        assert.match(cell.properties.id, new RegExp(`^CRS3035RES${resolution}mN`));
        assert.ok(cell.geometry.coordinates[0].every(([lon,lat]) => lon >= -0.8 && lon <= 0.12 && lat >= 44.91 && lat <= 45.39));
      }
    }
    assert.equal(unique[resolution].size, manifest.counts[resolution].uniqueCells);
    assert.equal(manifest.counts[resolution].communesWithData, 87);
  }
  assert.equal(unique[200].size, 9500);
  assert.equal(unique[1000].size, 1179);
});

test('les valeurs imputées restent distinctes et ne montrent pas leur effectif dans la fiche', async () => {
  const code = '33366';
  const url = new URL(`../data/insee-grid/${code}.json.gz`, import.meta.url);
  const data = await loadGrid(200, code, async requested => new Response(readFileSync(requested), {status: 200}));
  assert.ok(data.some(cell => cell.properties.status === 'A'));
  assert.ok(data.some(cell => cell.properties.status === 'I'));
  const imputed = data.find(cell => cell.properties.status === 'I');
  const measured = data.find(cell => cell.properties.status === 'A');
  assert.equal(gridCellLabel(imputed).includes(String(imputed.properties.ind) + ' individus'), false);
  assert.match(gridCellLabel(imputed), /Effectif non affiché.*Valeur imputée/);
  assert.match(gridCellLabel(measured), /Valeur diffusée par l’Insee/);
  assert.match(gridCellStyle(imputed, 200).dashArray, /3 3/);
  assert.equal(gridCellStyle(measured, 200).dashArray, undefined);
  assert.ok(readFileSync(url).length < 20_000);
  await assert.rejects(() => loadGrid(250, code), /résolution invalide/);
});
