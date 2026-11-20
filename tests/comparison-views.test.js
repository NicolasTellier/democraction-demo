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

import {SYNTHETIC_COMPARISONS_KEY,COMPARISONS_KEY,SYNTHETIC_DATASET_ID,parseSyntheticComparisonViews,addSyntheticComparisonView,findSyntheticComparisonView} from '../app/comparison-views.js';
import {syntheticListFixture} from '../app/synthetic-list-view.js';
const synthetic=(id='f-1')=>({version:1,datasetId:SYNTHETIC_DATASET_ID,id,savedAt:'2026-11-20T04:00:00.000Z',params:{codes:['33001','33002'],firstId:'a',secondId:'b',listAId:'a-1',listBId:'b-2',metric:'share'}});
test('paramètres fictifs : aller-retour versionné, copie indépendante et champs exclus',()=>{
 const v=synthetic();v.results=[{votes:99}];v.params.nom='Ne pas conserver';
 const views=addSyntheticComparisonView([],v),r=parseSyntheticComparisonViews(JSON.stringify(views));
 assert.notEqual(SYNTHETIC_COMPARISONS_KEY,COMPARISONS_KEY);
 assert.doesNotMatch(JSON.stringify(r),/votes|Ne pas conserver|results/);
 const restored=findSyntheticComparisonView(r,'f-1',syntheticListFixture(),['33001','33002','33003']);
 restored.params.codes.pop();assert.equal(r[0].params.codes.length,2);
 assert.deepEqual(r,views);
});
test('paramètres fictifs : refus des références retirées, jeu périmé et tour incompatible',()=>{
 const data=syntheticListFixture();
 for(const patch of [{firstId:'scrutin-retire'},{listBId:'liste-retiree'},{codes:['33999']}]){
  const v=synthetic();Object.assign(v.params,patch);
  assert.throws(()=>findSyntheticComparisonView([v],v.id,data,['33001','33002','33003']),/périmée/);
 }
 const old=synthetic();old.datasetId='synthetic-lists-v0';
 assert.equal(parseSyntheticComparisonViews(JSON.stringify([old])).length,1);
 assert.throws(()=>findSyntheticComparisonView([old],old.id,data,['33001','33002']),/périmée/);
 data.ballots[1].tour='t2';assert.throws(()=>findSyntheticComparisonView([synthetic()],'f-1',data,['33001','33002']),/périmée/);
});
test('paramètres fictifs : schéma invalide, doublons de communes et JSON mal formé refusés',()=>{
 for(const patch of [{version:2},{savedAt:'invalide'},{params:{...synthetic().params,codes:['33001','33001']}},{params:{...synthetic().params,metric:'other'}}]){
  assert.deepEqual(parseSyntheticComparisonViews(JSON.stringify([{...synthetic(),...patch}])),[]);
 }
 assert.deepEqual(parseSyntheticComparisonViews('{'),[]);
 assert.throws(()=>addSyntheticComparisonView([],{...synthetic(),datasetId:'autre'}),/incompatible/);
});
test('paramètres fictifs : doublons selon ordre des communes et mesure distincte',()=>{
 const views=addSyntheticComparisonView([],synthetic());
 const next=synthetic('f-2');next.params.codes.reverse();
 assert.throws(()=>addSyntheticComparisonView(views,next),/déjà enregistrée/);
 next.params.metric='votes';assert.equal(addSyntheticComparisonView(views,next).length,2);
});
test('paramètres fictifs : huit vues au maximum et suppression sans mutation',()=>{
 const views=parseSyntheticComparisonViews(JSON.stringify(Array.from({length:12},(_,i)=>synthetic('f-'+i))));
 assert.equal(views.length,8);
 const next=synthetic('nouvelle');next.params.metric='votes';
 const bounded=addSyntheticComparisonView(views,next);assert.equal(bounded.length,8);assert.equal(bounded[0].id,'nouvelle');
 assert.equal(views.filter(v=>v.id!=='f-1').length,7);assert.equal(views.length,8);
 assert.throws(()=>findSyntheticComparisonView(views,'absent',syntheticListFixture(),['33001']),/introuvable/);
});
