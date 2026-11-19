import test from 'node:test';
import assert from 'node:assert/strict';
import {participationDistribution,historicalParticipation} from '../app/election-history-chart.js';

const base={type:'muni',tour:'t1',annee:2026,codeInsee:'33001',inscrits:100,votants:0};
const select={year:2026,type:'muni',tour:'t1'};
const run=rows=>participationDistribution(rows,select);
test('distribution : dix classes disjointes, toutes les bornes et somme exacte',()=>{
 const rows=Array.from({length:101},(_,rate)=>({...base,codeInsee:String(33000+rate),votants:rate}));
 const before=structuredClone(rows),result=run(rows);
 assert.deepEqual(result.bins.map(bin=>bin.count),[10,10,10,10,10,10,10,10,10,11]);
 assert.equal(result.eligibleCommunes,101);assert.equal(result.excludedRows,0);
 assert.equal(result.unit,'communes');assert.deepEqual(result.selection,select);
 assert.deepEqual(result.bins.map(bin=>[bin.min,bin.max,bin.includeMax]),Array.from({length:10},(_,i)=>[i*10,(i+1)*10,i===9]));
 assert.equal(result.bins.reduce((sum,bin)=>sum+bin.count,0),101);
 assert.deepEqual(rows,before);
});
test('distribution : absences et effectifs incohérents exclus, zéro textuel conservé',()=>{
 for(const value of [null,undefined,'',' ',true,false,[],{},NaN,Infinity,-1,101,0.5]){
  const result=run([{...base,votants:value}]);assert.equal(result.eligibleCommunes,0,String(value));assert.equal(result.excludedRows,1);
 }
 for(const value of [null,undefined,'',' ',0,-1,true,100.5]){
  assert.equal(run([{...base,inscrits:value}]).eligibleCommunes,0,String(value));
 }
 assert.equal(run([{...base,inscrits:'100',votants:'0'}]).bins[0].count,1);
 assert.equal(run([{...base,votants:100}]).bins[9].count,1);
 assert.equal(run([{...base,codeInsee:null}]).excludedRows,1);
});
test('distribution : un seul scrutin/tour, comptage communal sans pondération',()=>{
 const result=run([{...base},{...base,codeInsee:'33002',inscrits:10000,votants:10000},
  {...base,annee:2020},{...base,type:'presi'},{...base,tour:'t2'}]);
 assert.equal(result.matchingRows,2);assert.equal(result.bins[0].count,1);assert.equal(result.bins[9].count,1);
 assert.equal(result.eligibleCommunes,2);assert.equal(result.excludedRows,0);
 assert.throws(()=>participationDistribution([],{}),/scrutin/);
 assert.throws(()=>participationDistribution([],{...select,year:null}),/scrutin/);
 const empty=run([]);assert.equal(empty.eligibleCommunes,0);assert(empty.bins.every(bin=>bin.count===0));
});
test('distribution : doublons d’une commune exclus sans choisir une ligne arbitraire',()=>{
 const result=run([{...base},{...base,votants:100},{...base,codeInsee:'33002',votants:50}]);
 assert.equal(result.duplicateCommunes,1);assert.equal(result.excludedRows,2);
 assert.equal(result.eligibleCommunes,1);assert.equal(result.bins[5].count,1);
});
test('distribution : fractions près des bornes et contrôles historiques compatibles',()=>{
 const rows=[{...base,inscrits:3,votants:1},{...base,codeInsee:'33002',inscrits:3,votants:2},
 {...base,codeInsee:'33003',inscrits:10,votants:3},{...base,codeInsee:'33004',inscrits:10,votants:9}];
 const result=run(rows);assert.equal(result.bins[3].count,2);assert.equal(result.bins[6].count,1);assert.equal(result.bins[9].count,1);
 const historical=historicalParticipation([{...base,votants:null},{...base,codeInsee:'33002',votants:0}],'muni','t1');
 assert.equal(historical[0].registered,100);assert.equal(historical[0].participation,0);
});

test('distribution : bornes exactes sur grands effectifs sûrs',()=>{
 const result=run([{...base,inscrits:9007199254740990,votants:6305039478318693}]);
 assert.equal(result.bins[7].count,1);assert.equal(result.bins[6].count,0);
});
