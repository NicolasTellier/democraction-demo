import test from 'node:test';
import assert from 'node:assert/strict';
import { electionTypeLabel, electionBallotLabel, importedScrutinLabel } from '../app/election-labels.js';
import { viewElectionHistory } from '../app/public-data-v3.js';

test('les sept codes restent distincts et lisibles sans altérer les données', () => {
  const expected = {
    CANT: 'Cantonales', DPMT: 'Départementales', EURO: 'Européennes',
    LEGI: 'Législatives', MUNI: 'Municipales', PRES: 'Présidentielles',
    REGI: 'Régionales',
  };
  for (const [code, label] of Object.entries(expected)) {
    const row = { type: code.toLowerCase(), annee: 2020, tour: 't1', libelle: `${code.toLowerCase()} 2020 — tour 1` };
    assert.equal(electionTypeLabel(code), label);
    assert.equal(electionBallotLabel(row), `${label} 2020 — tour 1`);
    assert.equal(row.type, code.toLowerCase());
  }
  assert.equal(electionBallotLabel({ type: 'autre', libelle: 'Référendum 2005' }), 'Référendum 2005');
  assert.equal(electionTypeLabel('autre'), 'Autre scrutin (autre)');
  assert.equal(importedScrutinLabel('MUNI'), 'Municipales');
  assert.equal(importedScrutinLabel('Référendum'), 'Référendum');
});

test('le menu, le graphique et le tableau affichent le libellé tout en filtrant sur le code', () => {
  const elections = { elections: [{ id: '2008_cant_t1', type: 'cant', libelle: 'cant 2008 — tour 1',
    annee: 2008, tour: 't1', codeInsee: '33366', commune: 'Saint-André-de-Cubzac',
    inscrits: 100, votants: 60, participation: 60, candidats: [] }] };
  const html = viewElectionHistory({ elections, matching: () => [{ codeInsee: '33366' }],
    filters: { electionType: 'cant', electionYear: '', electionTour: '' },
    esc: String, attr: String, fmtNumber: String, pct: () => '60 %', rate: () => 60,
    panel: (title, body) => `${title}${body}`, empty: () => '' });
  assert.match(html, /value="cant" selected>Cantonales<\/option>/);
  assert.match(html, /<option value="2008_cant_t1" selected>Cantonales 2008 — tour 1<\/option>/);
  assert.match(html, /<td>Cantonales 2008 — tour 1<\/td>/);
  assert.doesNotMatch(html, />cant 2008 — tour 1</);
});
