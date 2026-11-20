import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {territoryComparisonMeasure,comparableBallots} from '../app/territory-comparison.js';
import {parseComparisonViews,addComparisonView,findComparisonView} from '../app/comparison-views.js';

const read=p=>readFileSync(new URL(p,import.meta.url));
const fixture=JSON.parse(read('./fixtures/participation-difference-real.json'));
const raw=read('../data/elections-2008-2026.json.gz'),territory=read('../data/territoire-33-11-2026.json');
const data=JSON.parse(gunzipSync(raw)),codes=JSON.parse(territory).communes.map(c=>c.codeInsee);
const blob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const close=(actual,expected,context)=>expected===null?assert.equal(actual,null,context):assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<1e-10,context);

test('mesures réelles : 435 références, compléments, inverse, zéro et 83 absences sans mutation',()=>{
 assert.equal(blob(raw),fixture.dataBlob);assert.equal(blob(territory),fixture.territoryBlob);
 const before=JSON.stringify(data);let total=0;
 for(const scenario of fixture.scenarios){
  for(const measure of ['participation','abstention']){
   const result=territoryComparisonMeasure(data.elections,scenario.items.map(x=>x.code),scenario.first,scenario.second,measure);
   assert.equal(result.length,87);assert.equal(result.filter(x=>x.measureDelta!==null).length,scenario.paired);
   for(let i=0;i<result.length;i++){
    const actual=result[i],expected=scenario.items[i],factor=measure==='abstention'?-1:1;
    assert.equal(actual.codeInsee,expected.code);assert.equal(actual.measure,measure);
    close(actual.measureA,expected.a===null?null:measure==='abstention'?100-expected.a:expected.a,'A '+expected.code);
    close(actual.measureB,expected.b===null?null:measure==='abstention'?100-expected.b:expected.b,'B '+expected.code);
    close(actual.measureDelta,expected.delta===null?null:factor*expected.delta,'écart '+expected.code);
    if(expected.delta===0){assert.equal(actual.measureDelta,0);assert.equal(Object.is(actual.measureDelta,-0),false);}
    for(const [p,a] of [[actual.a,actual.measureA],[actual.b,actual.measureB]])if(p!==null&&measure==='abstention')close(p+a,100,'complément');
   }
  }
  total+=scenario.items.length;
 }
 assert.equal(total,435);assert.equal(fixture.scenarios[2].items.filter(x=>x.a===null).length,83);
 assert.equal(JSON.stringify(data),before);
});

test('vues réelles v1/v2 : rappel avec mesure, références et résultats recalculés',()=>{
 const scenario=fixture.scenarios[0],ballots=comparableBallots(data.elections),before=JSON.stringify(data);
 const legacy={version:1,id:'v1-real',ballotA:scenario.first,ballotB:scenario.second,type:'muni',tour:'t1',communeCodes:['33001','33366'],savedAt:'2026-11-20T10:00:00Z',source:fixture.source,sourceDate:fixture.updated};
 const modern={...legacy,version:2,id:'v2-real',measure:'abstention'};
 const views=parseComparisonViews(JSON.stringify(addComparisonView([legacy],modern)));
 for(const id of ['v1-real','v2-real']){
  const view=findComparisonView(views,id,ballots,codes),measure=view.version===1?'participation':view.measure;
  const result=territoryComparisonMeasure(data.elections,view.communeCodes,view.ballotA,view.ballotB,measure);
  for(const row of result){const ref=scenario.items.find(x=>x.code===row.codeInsee);close(row.measureDelta,measure==='abstention'?-ref.delta:ref.delta,id);}
 }
 assert.deepEqual(views.find(v=>v.id==='v1-real'),legacy);
 assert.throws(()=>findComparisonView(views,'v2-real',ballots.filter(b=>b.id!==scenario.second),codes),/plus dans les données/);
 assert.equal(JSON.stringify(data),before);assert.equal(views.length,2);
});
