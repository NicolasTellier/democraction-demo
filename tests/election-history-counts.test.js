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

test('barres historiques : même pondération, zéro explicite et absence sans barre',()=>{
 const rows=[{...base,annee:2020,votants:50},{...base},{...base,annee:2022,votants:null},
  {...base,codeInsee:'33366',inscrits:900,votants:null}];
 const html=viewParticipationTimeline({rows,type:'muni',tour:'t1',meta:{source:'Source de barres',miseAJour:'2026-11-19'},
  esc:String,fmtNumber:String,panel:(title,body)=>body});
 assert.ok(html.includes('Voir l’historique en barres'));assert.ok(html.includes('échelle de 0 à 100 %'));
 assert.equal((html.match(/class="history-bars-year"/g)||[]).length,2);
 assert.ok(html.includes('style="width:0%"'));assert.ok(html.includes('style="width:100%"'));
 assert.ok(html.includes('style="width:50%"'));assert.ok(!html.includes('data-year="2022"'));
 assert.ok(html.includes('1 commune(s) · 100 inscrits'));assert.ok(html.includes('Source de barres'));
 const noSeries=viewParticipationTimeline({rows:[{...base,votants:null}],type:'muni',tour:'t1',esc:String,panel:(t,b)=>b});
 assert.ok(!noSeries.includes('history-bars-year'));
});

test('barres empilées : parts complémentaires, zéro explicite, couverture et absence',()=>{
 const rows=[{...base,annee:2014,votants:100},{...base,annee:2020,votants:50},{...base},
  {...base,annee:2022,votants:null},{...base,codeInsee:'33366',inscrits:900,votants:null}];
 const html=viewParticipationTimeline({rows,type:'muni',tour:'t1',meta:{source:'Source empilée'},
  esc:String,fmtNumber:String,panel:(t,b)=>b});
 assert.equal((html.match(/class="history-stacked-year"/g)||[]).length,3);
 assert.ok(!html.includes('class="history-stacked-year" data-year="2022"'));
 assert.ok(html.includes('chaque barre représente 100 % des inscrits'));
 for(const width of [0,50,100])assert.ok(html.includes('class="history-stacked-participation" style="width:'+width+'%"'));
 assert.ok(html.includes('Participation : <strong>0,0 %</strong>'));
 assert.ok(html.includes('Abstention : <strong>100,0 %</strong>'));
 assert.ok(html.includes('1 commune(s) · 100 inscrits'));
 assert.ok(html.includes('Source empilée'));
});
