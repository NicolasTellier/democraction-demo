import test from 'node:test';
import assert from 'node:assert/strict';
import { addComparisonView, findComparisonView, parseComparisonViews } from '../app/comparison-views.js';

const ballots = [
  { id: '2020_muni_t1', type: 'muni', tour: 't1' },
  { id: '2026_muni_t1', type: 'muni', tour: 't1' },
  { id: '2026_muni_t2', type: 'muni', tour: 't2' },
];
const codes = ['33001', '33366'];
const sample = (id = 'vue-1') => ({
  version: 1, id, ballotA: ballots[0].id, ballotB: ballots[1].id,
  type: 'muni', tour: 't1', communeCodes: codes, savedAt: '2026-11-18T19:00:00.000Z',
  source: 'Source publique fictive', sourceDate: '2026-11-01',
});

test('une comparaison agrégée se sauvegarde, se retrouve et se retire sans données personnelles', () => {
  const views = addComparisonView([], sample());
  const reopened = parseComparisonViews(JSON.stringify(views));
  assert.deepEqual(reopened, views);
  assert.deepEqual(findComparisonView(reopened, 'vue-1', ballots, codes), sample());
  assert.deepEqual(reopened.filter(view => view.id !== 'vue-1'), []);
  assert.equal(JSON.stringify(reopened).includes('prénom'), false);
});

test('les doublons, données mal formées et références périmées sont refusés', () => {
  const views = addComparisonView([], sample());
  assert.throws(() => addComparisonView(views, sample('vue-2')), /déjà enregistrée/);
  assert.throws(() => addComparisonView([], { ...sample(), communeCodes: ['33001', '33001'] }), /Choisissez/);
  assert.throws(() => findComparisonView(views, 'vue-1', ballots.slice(0, 1), codes), /plus dans les données/);
  assert.throws(() => findComparisonView(views, 'vue-1', ballots, ['33001']), /plus dans les données/);
  assert.deepEqual(parseComparisonViews('{'), []);
  assert.deepEqual(parseComparisonViews(JSON.stringify([{ ...sample(), communeCodes: ['not-a-code'] }])), []);
});

test('la liste locale reste bornée à huit vues', () => {
  const views = parseComparisonViews(JSON.stringify(Array.from({ length: 12 }, (_, i) => sample('vue-' + i))));
  assert.equal(views.length, 8);
});
