import test from 'node:test';
import assert from 'node:assert/strict';
import { comparableBallots, territoryComparison, viewTerritoryComparison } from '../app/territory-comparison.js';

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
