import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {participationDistribution} from '../app/election-history-chart.js';

test('distribution réelle : six références indépendantes, empreinte et couverture',()=>{
 const reference=JSON.parse(readFileSync(new URL('./fixtures/participation-real.json',import.meta.url)));
 const raw=readFileSync(new URL('../data/elections-2008-2026.json.gz',import.meta.url));
 const digest=createHash('sha1').update('blob '+raw.length+'\0').update(raw).digest('hex');
 assert.equal(digest,reference.dataBlob);
 const data=JSON.parse(gunzipSync(raw));
 assert.equal(data.meta.source,reference.source);assert.equal(data.meta.miseAJour,reference.updated);
 for(const scenario of reference.scenarios){
  const rows=data.elections.filter(row=>!scenario.scope||row.commune===scenario.scope);
  const result=participationDistribution(rows,scenario);
  assert.deepEqual(result.bins.map(bin=>bin.count),scenario.bins,JSON.stringify(scenario));
  assert.equal(result.eligibleCommunes,scenario.eligible);
  assert.equal(result.excludedRows,scenario.excluded);assert.equal(result.duplicateCommunes,scenario.duplicates);
  assert.equal(result.bins.reduce((sum,bin)=>sum+bin.count,0),scenario.eligible);
 }
});
