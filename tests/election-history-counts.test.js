import test from 'node:test';
import assert from 'node:assert/strict';
import {historicalParticipation,viewParticipationTimeline} from '../app/election-history-chart.js';

const base={type:'muni',tour:'t1',annee:2026,codeInsee:'33001',inscrits:100,votants:0};
test('historique : effectifs absents exclus, zéro explicite préservé et couverture exacte',()=>{
 for(const value of [null,undefined,'',' ',true,false,[],{},NaN,Infinity,-1,101,0.5]){
  assert.deepEqual(historicalParticipation([{...base,votants:value}],'muni','t1'),[],String(value));
 }
 for(const value of [null,undefined,'',' ',0,-1,true,100.5]){
  assert.deepEqual(historicalParticipation([{...base,inscrits:value}],'muni','t1'),[],String(value));
 }
 for(const zero of [0,'0']){
  const [row]=historicalParticipation([{...base,votants:zero}],'muni','t1');
  assert.equal(row.participation,0);assert.equal(row.abstention,100);assert.equal(row.registered,100);
 }
 const rows=[{...base,annee:2020,votants:50},{...base,votants:20},{...base,codeInsee:'33002',inscrits:300,votants:180},
  {...base,codeInsee:'33003',inscrits:900,votants:null},{...base,annee:2022,votants:''}];
 const before=structuredClone(rows);
 const series=historicalParticipation(rows,'muni','t1');
 assert.deepEqual(series.map(r=>[r.year,r.registered,r.voters,r.communes]),[[2020,100,50,1],[2026,400,200,2]]);
 assert.equal(series[1].participation,50);assert.equal(series[1].abstention,50);
 assert.deepEqual(rows,before);
 const html=viewParticipationTimeline({rows,type:'muni',tour:'t1',meta:{source:'Source synthétique',miseAJour:'2026-11-19'},
  esc:String,fmtNumber:String,panel:(title,body)=>body});
 assert.ok(html.includes('Source synthétique'));assert.ok(html.includes('2026-11-19'));
 assert.ok(!html.includes('2022</th>'));assert.ok(html.includes('400</td>'));
});
