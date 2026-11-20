import test from 'node:test';
import assert from 'node:assert/strict';
import { comparableBallots, territoryComparison, territoryComparisonMeasure, viewTerritoryComparison } from '../app/territory-comparison.js';

const rows = [
  { id: '2020_muni_t1', type: 'muni', tour: 't1', annee: 2020, codeInsee: '33001', inscrits: 100, votants: 50 },
  { id: '2020_muni_t1', type: 'muni', tour: 't1', annee: 2020, codeInsee: '33002', inscrits: 900, votants: 720 },
  { id: '2026_muni_t1', type: 'muni', tour: 't1', annee: 2026, codeInsee: '33001', inscrits: 100, votants: 80 },
  { id: '2026_muni_t1', type: 'muni', tour: 't1', annee: 2026, codeInsee: '33002', inscrits: 100, votants: 50 },
  { id: '2026_muni_t2', type: 'muni', tour: 't2', annee: 2026, codeInsee: '33001', inscrits: 100, votants: 99 },
  { id: '2018_pres_t1', type: 'pres', tour: 't1', annee: 2018, codeInsee: '33001', inscrits: 100, votants: 99 },
  { id: '2020_muni_t1', type: 'muni', tour: 't1', annee: 2020, codeInsee: '33003', inscrits: 0, votants: 10 },
];
const communes = [
  { codeInsee: '33001', nom: 'Abzac' },
  { codeInsee: '33002', nom: 'Saint-André-de-Cubzac' },
  { codeInsee: '33003', nom: 'Commune sans résultat valide' },
];

test('choix des scrutins strictement selon type et tour, sans agréger les différents tours', () => {
  assert.deepEqual(comparableBallots(rows, 'muni', 't1').map(ballot => ballot.id), ['2026_muni_t1', '2020_muni_t1']);
});

test('comparaison communale : calcul depuis les effectifs, absence explicite de résultat', () => {
  const values = territoryComparison(rows, ['33001', '33002', '33003'], '2020_muni_t1', '2026_muni_t1');
  assert.equal(values[0].delta, 30);
  assert.equal(values[1].a, 80);
  assert.equal(values[1].b, 50);
  assert.equal(values[1].delta, -30);
  assert.equal(values[2].a, null);
  assert.equal(values[2].delta, null);
});

test('un effectif absent ne devient pas une participation nulle', () => {
  for (const missing of [null, undefined, '', ' ', '\t\n', false]) {
    const incomplete = [{ ...rows[0], votants: missing }, rows[1], rows[2]];
    const [value] = territoryComparison(incomplete, ['33001'], '2020_muni_t1', '2026_muni_t1');
    assert.equal(value.a, null, `votants absent : ${String(missing)}`);
    assert.equal(value.first, undefined);
    assert.equal(value.delta, null);
    assert.deepEqual(comparableBallots([incomplete[0]], 'muni', 't1'), []);
    const html = viewTerritoryComparison({ rows: incomplete, communes: [communes[0]],
      filters: { electionType: 'muni', electionTour: 't1', analysisCommuneCodes: ['33001'],
        analysisBallotA: '2020_muni_t1', analysisBallotB: '2026_muni_t1' },
      meta: {}, esc: String, attr: String, fmtNumber: String, panel: (title, body) => body });
    assert.match(html, /<th scope="row">Abzac<\/th><td class="num">—<\/td><td class="num">—<\/td><td class="num">—<\/td>/);
    assert.doesNotMatch(html, />0,0 %<|>100,0 %</);
  }
});

test('zéro votant explicite reste un résultat valide', () => {
  for (const zero of [0, '0']) {
    const explicitZero = [{ ...rows[0], votants: zero }, rows[2]];
    const [value] = territoryComparison(explicitZero, ['33001'], '2020_muni_t1', '2026_muni_t1');
    assert.equal(value.a, 0);
    assert.equal(value.delta, 80);
    assert.deepEqual(comparableBallots(explicitZero, 'muni', 't1').map(ballot => ballot.id), ['2026_muni_t1', '2020_muni_t1']);
  }
});

test('la vue sépare deux scrutins comparables et expose la source et les valeurs exactes', () => {
  const html = viewTerritoryComparison({ rows, communes, filters: { electionType: 'muni', electionTour: 't1', analysisCommuneCodes: ['33001', '33002', '33003'] },
    meta: { source: 'Source de recette', miseAJour: '2026-07-07' }, esc: String, attr: String, fmtNumber: String, panel: (title, body) => `${title}${body}` });
  assert.match(html, /Municipales 2020 — tour 1/);
  assert.match(html, /Municipales 2026 — tour 1/);
  assert.match(html, /Source : Source de recette · mise à jour 2026-07-07/);
  assert.match(html, /<th scope="row">Abzac<\/th><td class="num">100<\/td><td class="num">50<\/td><td class="num">50,0 %<\/td><td class="num">50,0 %<\/td><td class="num">100<\/td><td class="num">80<\/td><td class="num">80,0 %<\/td><td class="num">20,0 %<\/td><td class="num">\+30,0 points/);
  assert.match(html, /<th scope="row">Commune sans résultat valide<\/th><td class="num">—<\/td>/);
  assert.doesNotMatch(html, /99,0 %/);
});

test('la vue propose enregistrement, rappel et suppression sans contenu nominatif', () => {
  const html = viewTerritoryComparison({ rows, communes,
    filters: { electionType: 'muni', electionTour: 't1', analysisCommuneCodes: ['33001', '33002'] },
    savedViews: [{ id: 'vue-1', ballotA: '2020_muni_t1', ballotB: '2026_muni_t1',
      communeCodes: ['33001', '33002'], savedAt: '2026-11-18T19:00:00.000Z',
      source: 'Source de recette', sourceDate: '2026-07-07' }],
    meta: { source: 'Source de recette', miseAJour: '2026-07-07' },
    esc: String, attr: String, fmtNumber: String, panel: (title, body) => body });
  assert.match(html, /data-action="save-comparison-view"/);
  assert.match(html, /data-action="open-comparison-view" data-comparison-id="vue-1"/);
  assert.match(html, /data-action="delete-comparison-view" data-comparison-id="vue-1"/);
  assert.match(html, /Source : Source de recette · mise à jour 2026-07-07/);
});

test('indicateur communal : complémentarité et écart opposé, inversion, entrées intactes',()=>{
 const before=structuredClone(rows);
 const p=territoryComparisonMeasure(rows,['33001'],'2020_muni_t1','2026_muni_t1');
 const a=territoryComparisonMeasure(rows,['33001'],'2020_muni_t1','2026_muni_t1','abstention');
 assert.deepEqual([p[0].measureA,p[0].measureB,p[0].measureDelta],[50,80,30]);
 assert.deepEqual([a[0].measureA,a[0].measureB,a[0].measureDelta],[50,20,-30]);
 assert.equal(a[0].a,50);assert.equal(a[0].b,80);assert.equal(a[0].delta,30);
 assert.equal(territoryComparisonMeasure(rows,['33001'],'2026_muni_t1','2020_muni_t1','abstention')[0].measureDelta,30);
 assert.deepEqual(rows,before);assert.throws(()=>territoryComparisonMeasure(rows,[],'a','b','votes'),/invalide/);
});
test('indicateur communal : absence et bornes zéro/100 sans zéro négatif',()=>{
 const data=[{...rows[0],votants:0},{...rows[2],votants:0}];
 const [same,missing]=territoryComparisonMeasure(data,['33001','33002'],'2020_muni_t1','2026_muni_t1','abstention');
 assert.equal(same.measureA,100);assert.equal(same.measureDelta,0);assert.equal(Object.is(same.measureDelta,-0),false);
 assert.equal(missing.measureA,null);assert.equal(missing.measureDelta,null);
 data[1].votants=100;
 assert.equal(territoryComparisonMeasure(data,['33001'],'2020_muni_t1','2026_muni_t1','abstention')[0].measureDelta,-100);
});
