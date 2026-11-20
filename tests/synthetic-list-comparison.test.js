import test from 'node:test';
import assert from 'node:assert/strict';
import { compareSyntheticListResults } from '../app/territory-comparison.js';

const fixture = () => ({
  schemaVersion: 1, synthetic: true,
  ballots: [
    { id: 'a', type: 'muni', tour: 't1', annee: 2020, date: '2020-03-15', source: { label: 'Jeu fictif A', date: '2026-11-20' } },
    { id: 'b', type: 'muni', tour: 't1', annee: 2026, date: '2026-03-15', source: { label: 'Jeu fictif B', date: '2026-11-20' } },
  ],
  results: [
    { ballotId: 'a', codeInsee: '33001', exprimes: 200, listes: [
      { id: 'a-1', label: 'Liste fictive identique', votes: 50 }, { id: 'a-2', label: 'Autre liste fictive', votes: 150 },
    ] },
    { ballotId: 'b', codeInsee: '33001', exprimes: 300, listes: [
      { id: 'b-1', label: 'Liste fictive identique', votes: 180 }, { id: 'b-2', label: 'Autre liste fictive', votes: 120 },
    ] },
  ],
});
const options = { codes: ['33001'], firstId: 'a', secondId: 'b', listAId: 'a-1', listBId: 'b-2' };
const compare = (data = fixture(), overrides = {}) => compareSyntheticListResults(data, { ...options, ...overrides });

test('contrat fictif : choix explicites, voix B − A, deux provenances et entrée inchangée', () => {
  const data = fixture(), before = structuredClone(data), r = compare(data);
  assert.deepEqual([r.items[0].a, r.items[0].b, r.items[0].delta], [50, 120, 70]);
  assert.equal(r.items[0].second.listId, 'b-2'); // Pas la liste homonyme b-1.
  assert.equal(r.unit, 'voix'); assert.equal(r.direction, 'B − A');
  assert.equal(r.first.label, 'Municipales 2020 — tour 1');
  assert.equal(r.second.date, '2026-03-15');
  assert.deepEqual(r.first.source, { label: 'Jeu fictif A', date: '2026-11-20' });
  r.first.source.label = 'Copie modifiée';
  assert.deepEqual(data, before);
});

test('part des exprimés : dénominateurs différents, points et inversion de signe', () => {
  const r = compare(fixture(), { metric: 'share' }), v = r.items[0];
  assert.deepEqual([v.a, v.b, v.delta], [25, 40, 15]);
  assert.equal(r.unit, 'points des suffrages exprimés');
  const reverse = compare(fixture(), { firstId: 'b', secondId: 'a', listAId: 'b-2', listBId: 'a-1', metric: 'share' });
  assert.equal(reverse.items[0].delta, -15);
});

test('zéro explicite conservé ; exprimés nuls autorisent les voix mais pas un pourcentage', () => {
  const data = fixture(); data.results[0].listes[0].votes = 0; data.results[0].listes[1].votes = 200;
  assert.equal(compare(data, { metric: 'share' }).items[0].a, 0);
  data.results[0].exprimes = 0; data.results[0].listes[1].votes = 0;
  const count = compare(data), share = compare(data, { metric: 'share' });
  assert.equal(count.items[0].a, 0); assert.equal(count.coverage.paired, 1);
  assert.equal(share.items[0].a, null); assert.equal(share.items[0].delta, null);
  assert.equal(share.items[0].first.shareStatus, 'zero-denominator');
  assert.equal(share.coverage.paired, 0);
});

test('absence de résultat ou de liste distincte de zéro, sans rapprochement par libellé', () => {
  const data = fixture(); data.results[0].listes[0].id = 'a-inconnu';
  const r = compare(data, { codes: ['33001', '33002', '33001'] });
  assert.equal(r.items[0].first.status, 'missing-list');
  assert.equal(r.items[0].a, null); assert.equal(r.items[0].delta, null);
  assert.equal(r.items[1].first.status, 'missing-result');
  assert.equal(r.items[1].second.status, 'missing-result');
  assert.deepEqual(r.coverage, { requested: 2, firstAvailable: 0, secondAvailable: 1, paired: 0, unavailable: 2 });
});

test('doublons de résultat et de liste rendent les valeurs indisponibles', () => {
  const data = fixture(); data.results.push(structuredClone(data.results[0]));
  assert.equal(compare(data).items[0].first.status, 'duplicate-result');
  data.results.pop(); data.results[0].listes[1].id = 'a-1';
  const r = compare(data);
  assert.equal(r.items[0].first.status, 'duplicate-list'); assert.equal(r.items[0].delta, null);
});

test('effectifs absents, coercitifs, fractionnaires ou hors limites refusés sans zéro imputé', () => {
  for (const value of [null, undefined, '', '0', false, NaN, Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    for (const field of ['exprimes', 'votes']) {
      const data = fixture();
      if (field === 'exprimes') data.results[0].exprimes = value;
      else data.results[0].listes[0].votes = value;
      const r = compare(data);
      assert.equal(r.items[0].first.status, 'invalid-result', field + ':' + String(value));
      assert.equal(r.items[0].a, null); assert.equal(r.items[0].delta, null);
    }
  }
});

test('somme complète des listes contrôlée, y compris au-delà du maximum entier sûr', () => {
  const data = fixture(); data.results[0].listes[1].votes = 151;
  assert.equal(compare(data).items[0].first.status, 'invalid-total');
  data.results[0].exprimes = Number.MAX_SAFE_INTEGER;
  data.results[0].listes.forEach(list => { list.votes = Number.MAX_SAFE_INTEGER; });
  assert.equal(compare(data).items[0].first.status, 'invalid-total');
});

test('scrutins inconnus, dupliqués, types et tours incompatibles refusés', () => {
  assert.throws(() => compare(fixture(), { firstId: 'absent' }), /inconnu ou ambigu/);
  assert.throws(() => compare(fixture(), { secondId: 'a' }), /distincts/);
  const duplicate = fixture(); duplicate.ballots.push({ ...duplicate.ballots[0] });
  assert.throws(() => compare(duplicate), /inconnu ou ambigu/);
  for (const change of [{ type: 'pres' }, { tour: 't2' }]) {
    const data = fixture(); Object.assign(data.ballots[1], change);
    assert.throws(() => compare(data), /même type et de même tour/);
  }
});

test('provenance et dates réelles du calendrier obligatoires dans le contrat fictif', () => {
  for (const change of [{ date: '2026-02-30' }, { date: '2025-03-15' }, { annee: '2026' },
    { source: null }, { source: { label: ' ', date: '2026-11-20' } },
    { source: { label: 'Jeu fictif', date: '2026-13-01' } }, { tour: 'tour 1' }]) {
    const data = fixture(); Object.assign(data.ballots[1], change);
    assert.throws(() => compare(data), /Métadonnées/);
  }
});

test('enveloppe synthétique, codes textuels, mesure et identifiants de listes obligatoires', () => {
  for (const change of [{ synthetic: false }, { schemaVersion: 2 }, { ballots: null }, { results: null }]) {
    assert.throws(() => compare(Object.assign(fixture(), change)), /Contrat synthétique/);
  }
  for (const change of [{ codes: [] }, { codes: [33001] }, { codes: ['3300'] }, { codes: ['33001|a'] }])
    assert.throws(() => compare(fixture(), change), /code INSEE/);
  assert.throws(() => compare(fixture(), { metric: 'inscrits' }), /Mesure/);
  for (const listAId of ['', null, ' a-1 ']) assert.throws(() => compare(fixture(), { listAId }), /explicites/);
});

test('taux rationnels égaux restent exactement zéro et bornes zéro/100 préservées', () => {
  const data = fixture();
  data.results[0].exprimes = 3; data.results[0].listes[0].votes = 1; data.results[0].listes[1].votes = 2;
  data.results[1].exprimes = 9; data.results[1].listes[0].votes = 6; data.results[1].listes[1].votes = 3;
  assert.equal(compare(data, { metric: 'share' }).items[0].delta, 0);
  data.results[0].listes[0].votes = 0; data.results[0].listes[1].votes = 3;
  data.results[1].listes[0].votes = 0; data.results[1].listes[1].votes = 9;
  assert.deepEqual([compare(data, { metric: 'share' }).items[0].a,
    compare(data, { metric: 'share' }).items[0].b, compare(data, { metric: 'share' }).items[0].delta], [0, 100, 100]);
});

test('sélection territoriale limitée et champs étrangers non propagés', () => {
  const data = fixture(); data.results[0].secret = 'champ hors contrat';
  data.results.push({ ballotId: 'a', codeInsee: '33002', exprimes: -1, listes: null });
  const r = compare(data);
  assert.equal(r.items.length, 1); assert.equal(r.coverage.paired, 1);
  assert.doesNotMatch(JSON.stringify(r), /champ hors contrat|secret|33002/);
});
