import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {abstentionRate,weightedAbstention} from '../app/core.js';

test('abstention calculée sur inscrits et votants, sans moyenne de taux communaux',()=>{
 assert.equal(abstentionRate({inscrits:100,votants:70}),30);
 const total=weightedAbstention([{inscrits:100,votants:70},{inscrits:900,votants:720}]);
 assert.deepEqual(total,{communes:2,inscrits:1000,abstentions:210,percent:21});
 assert.equal(abstentionRate({inscrits:0,votants:0}),null);
 assert.equal(abstentionRate({inscrits:100,votants:110}),null);
 assert.equal(abstentionRate({inscrits:100,votants:null}),null);
});

test('87 taux communaux du premier tour municipal 2026 reposent sur les effectifs publics',()=>{
 const data=JSON.parse(gunzipSync(readFileSync(new URL('../data/elections-2008-2026.json.gz',import.meta.url))));
 const rows=data.elections.filter(row=>row.id==='2026_muni_t1');
 assert.equal(rows.length,87);
 assert.ok(rows.every(row=>Number.isFinite(abstentionRate(row))&&Math.round(abstentionRate(row)*row.inscrits/100)===row.inscrits-row.votants));
 const abzac=rows.find(row=>row.codeInsee==='33001');
 assert.deepEqual([abzac.inscrits,abzac.votants,abzac.inscrits-abzac.votants],[1598,938,660]);
 assert.ok(Math.abs(abstentionRate(abzac)-41.30162703379224)<1e-8);
 const total=weightedAbstention(rows);
 assert.equal(total.communes,87);
 assert.equal(total.abstentions,total.inscrits-rows.reduce((sum,row)=>sum+row.votants,0));
});
