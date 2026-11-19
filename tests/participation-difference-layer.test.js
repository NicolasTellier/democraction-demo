import test from 'node:test';
import assert from 'node:assert/strict';
import {participationDifferenceLayer,territoryComparison} from '../app/territory-comparison.js';
const a={id:'2020_muni_t1',type:'muni',tour:'t1',annee:2020,codeInsee:'33001',inscrits:100,votants:20};
const b={...a,id:'2026_muni_t1',annee:2026,votants:80};
const run=(rows=[a,b],codes=['33001'])=>participationDifferenceLayer(rows,codes,a.id,b.id,{source:'Source fictive',miseAJour:'2026-11-19'});
test('couche d’écart : réutilisation du comparateur, signe B moins A, unité et provenance',()=>{
 const rows=[a,b],before=structuredClone(rows);
 const result=run(rows);
 assert.equal(result.items[0].mapValue,territoryComparison(rows,['33001'],a.id,b.id)[0].delta);
 assert.equal(result.items[0].mapValue,60);assert.equal(result.direction,'B − A');
 assert.equal(result.unit,'points de participation');assert.deepEqual(result.domain,[-100,100]);
 assert.equal(result.first.id,a.id);assert.equal(result.second.id,b.id);
 assert.deepEqual(result.source,{label:'Source fictive',updatedAt:'2026-11-19'});
 assert.deepEqual(result.coverage,{requested:1,paired:1,unavailable:0});
 assert.deepEqual(rows,before);
 assert.equal(participationDifferenceLayer(rows,['33001'],b.id,a.id).items[0].mapValue,-60);
});
test('couche d’écart : zéro et bornes extrêmes conservés, codes uniques sans classement',()=>{
 assert.equal(run([{...a,votants:0},{...b,votants:100}]).items[0].mapValue,100);
 assert.equal(run([{...a,votants:100},{...b,votants:0}]).items[0].mapValue,-100);
 assert.equal(run([{...a,votants:'0'},{...b,votants:0}]).items[0].mapValue,0);
 const result=run([a,b],['33002','33001','33001']);
 assert.deepEqual(result.items.map(item=>item.codeInsee),['33002','33001']);
 assert.deepEqual(result.coverage,{requested:2,paired:1,unavailable:1});
 assert.equal(result.items[0].mapValue,null);
});
test('couche d’écart : absence et effectifs invalides ne deviennent jamais zéro',()=>{
 const missing=run([a,{...b,codeInsee:'33002'}]);
 assert.equal(missing.items[0].mapValue,null);assert.equal(missing.items[0].statusB,'missing');
 for(const value of [null,undefined,'',' ',true,false,-1,101,0.5,Infinity,Number.MAX_SAFE_INTEGER+1]){
  const result=run([{...a,votants:value},b]);
  assert.equal(result.items[0].participationA,null,String(value));
  assert.equal(result.items[0].mapValue,null,String(value));assert.equal(result.items[0].statusA,'invalid');
 }
 for(const value of [null,undefined,'',' ',0,-1,100.5,Infinity,Number.MAX_SAFE_INTEGER+1]){
  const result=run([{...a,inscrits:value},b]);assert.equal(result.items[0].mapValue,null);assert.equal(result.items[0].statusA,'invalid');
 }
});
test('couche d’écart : doublons exclus même si une occurrence est invalide',()=>{
 for(const rows of [[a,{...a,votants:10},b],[{...a,votants:null},a,b],[b,a,a]]){
  const result=run(rows);assert.equal(result.items[0].statusA,'duplicate');
  assert.equal(result.items[0].participationA,null);assert.equal(result.items[0].mapValue,null);
  assert.equal(result.coverage.paired,0);
 }
});
test('couche d’écart : scrutins distincts et métadonnées compatibles exigés',()=>{
 assert.throws(()=>participationDifferenceLayer([a,b],['33001'],a.id,a.id),/distincts/);
 assert.throws(()=>participationDifferenceLayer([a,b],['33001'],'inconnu',b.id),/inconnu/);
 assert.throws(()=>run([a,{...b,type:'pres'}]),/même type/);
 assert.throws(()=>run([a,{...b,tour:'t2'}]),/même type/);
 assert.throws(()=>run([a,b,{...b,codeInsee:'33002',annee:2025}]),/ambiguës/);
 assert.throws(()=>run([a,{...b,annee:null}]),/ambiguës/);
 assert.throws(()=>run([a,b],['inconnu']),/INSEE/);
});
test('couche d’écart : sélection vide et provenance absente restent explicites',()=>{
 const empty=run([a,b],[]);assert.deepEqual(empty.items,[]);
 assert.deepEqual(empty.coverage,{requested:0,paired:0,unavailable:0});
 const result=participationDifferenceLayer([a,b],['33003'],a.id,b.id);
 assert.deepEqual(result.source,{label:null,updatedAt:null});
 assert.equal(result.items[0].mapValue,null);assert.equal(result.items[0].statusA,'missing');
});

test('couche d’écart : zéro rationnel et borne 100 sans artefact flottant',()=>{
 const n=9007199254740976;
 const result=run([{...a,inscrits:n,votants:0},{...b,inscrits:n,votants:n}]);
 assert.equal(result.items[0].participationB,100);assert.equal(result.items[0].mapValue,100);
 assert.equal(run([{...a,inscrits:n,votants:n},{...b,votants:100}]).items[0].mapValue,0);
 assert.equal(run([{...a,inscrits:7,votants:3},{...b,inscrits:14,votants:6}]).items[0].mapValue,0);
});
