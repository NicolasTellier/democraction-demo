import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {participationDifferenceLayer} from '../app/territory-comparison.js';

test('écarts réels : cinq références rationnelles, 435 communes/scrutins, zéro et couverture',()=>{
 const fixture=JSON.parse(readFileSync(new URL('./fixtures/participation-difference-real.json',import.meta.url)));
 const read=path=>readFileSync(new URL(path,import.meta.url));
 const raw=read('../data/elections-2008-2026.json.gz');
 const territory=read('../data/territoire-33-11-2026.json');
 const blob=bytes=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 assert.equal(blob(raw),fixture.dataBlob);assert.equal(blob(territory),fixture.territoryBlob);
 const data=JSON.parse(gunzipSync(raw)),before=JSON.stringify(data);
 for(const scenario of fixture.scenarios){
  const result=participationDifferenceLayer(data.elections,scenario.items.map(row=>row.code),scenario.first,scenario.second,data.meta);
  assert.equal(result.direction,'B − A');assert.equal(result.unit,'points de participation');
  assert.deepEqual(result.domain,[-100,100]);
  assert.deepEqual(result.source,{label:fixture.source,updatedAt:fixture.updated});
  assert.deepEqual(result.coverage,{requested:87,paired:scenario.paired,unavailable:87-scenario.paired});
  for(let i=0;i<scenario.items.length;i++){
   const expected=scenario.items[i],actual=result.items[i];
   assert.equal(actual.codeInsee,expected.code);
   for(const [key,reference] of [['participationA',expected.a],['participationB',expected.b],['mapValue',expected.delta]]){
    if(reference===null)assert.equal(actual[key],null,scenario.first+' '+expected.code+' '+key);
    else assert.ok(Math.abs(actual[key]-reference)<1e-10,scenario.first+' '+expected.code+' '+key);
   }
   assert.equal(actual.statusA,expected.a===null?'missing':'available');
   assert.equal(actual.statusB,expected.b===null?'missing':'available');
   if(expected.delta===0)assert.equal(actual.mapValue,0);
  }
 }
 assert.equal(JSON.stringify(data),before);
});
