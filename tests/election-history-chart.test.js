import test from 'node:test';
import assert from 'node:assert/strict';
import { historicalParticipation, viewParticipationTimeline } from '../app/election-history-chart.js';
import { viewElectionHistory } from '../app/public-data-v3.js';

const rows = [
  { type: 'muni', tour: 't1', annee: 2020, codeInsee: '33001', inscrits: 100, votants: 50 },
  { type: 'muni', tour: 't1', annee: 2020, codeInsee: '33002', inscrits: 900, votants: 720 },
  { type: 'muni', tour: 't1', annee: 2026, codeInsee: '33001', inscrits: 100, votants: 80 },
  { type: 'muni', tour: 't1', annee: 2026, codeInsee: '33003', inscrits: 0, votants: 10 },
  { type: 'muni', tour: 't2', annee: 2020, codeInsee: '33001', inscrits: 100, votants: 99 },
];

test('l’historique pondère les communes par inscrits et écarte les effectifs incohérents', () => {
  const series = historicalParticipation(rows, 'muni', 't1');
  assert.deepEqual(series.map(({ year, registered, voters, communes }) => [year, registered, voters, communes]),
    [[2020, 1000, 770, 2], [2026, 100, 80, 1]]);
  assert.equal(series[0].participation, 77);
  assert.equal(series[0].abstention, 23);
  assert.equal(series[1].participation, 80);
});

test('la courbe nomme la source et expose les valeurs exactes dans un tableau', () => {
  const html = viewParticipationTimeline({ rows, type: 'muni', tour: 't1',
    meta: { source: 'Source publique de recette', miseAJour: '2026-07-07' },
    esc: String, fmtNumber: String, panel: (title, body) => `${title}${body}` });
  assert.match(html, /Municipales · 1er tour/);
  assert.match(html, /Source : Source publique de recette · mise à jour 2026-07-07/);
  assert.match(html, /<svg[^>]+role="img"/);
  assert.match(html, /<tr><th scope="row">2020<\/th><td class="num">2<\/td><td class="num">1000<\/td><td class="num">77,0 %<\/td><td class="num">23,0 %<\/td>/);
  assert.match(html, /ne mesurent pas des transferts individuels de voix/);
});

test('le filtre électoral existant pilote la courbe sans mélanger les tours', () => {
  const elections = { meta: { source: 'Source de recette' }, elections: rows.map((row, index) => ({
    ...row, id: `${row.annee}_${row.type}_${row.tour}`, libelle: 'Scrutin',
    commune: `Commune ${index}`, participation: row.inscrits ? 100 * row.votants / row.inscrits : null,
    candidats: [],
  })) };
  const html = viewElectionHistory({ elections,
    matching: () => [{ codeInsee: '33001' }, { codeInsee: '33002' }, { codeInsee: '33003' }],
    filters: { electionType: 'muni', electionYear: '2026', electionTour: 't1' },
    esc: String, attr: String, fmtNumber: String, pct: () => '', rate: () => 0,
    panel: (title, body) => `${title}${body}`, empty: () => '' });
  assert.match(html, /<svg class="election-timeline"/);
  assert.match(html, /2020<\/th><td class="num">2<\/td><td class="num">1000/);
  assert.doesNotMatch(html, /99,0 %/);
});
