import test from 'node:test';
import assert from 'node:assert/strict';
import {viewParticipationDistribution} from '../app/election-history-chart.js';
const base={annee:2026,type:'muni',tour:'t1',codeInsee:'33001',inscrits:100,votants:0};
const render=extra=>viewParticipationDistribution({rows:[],year:2026,type:'muni',tour:'t1',meta:{source:'Source fictive',miseAJour:'2026-11-19'},esc:value=>String(value).replaceAll('<','&lt;'),fmtNumber:String,panel:(t,b)=>b,...extra});
test('histogramme rendu : dix classes, compte et fréquences sur le même dénominateur',()=>{
 const html=render({rows:[base,{...base,codeInsee:'33002',votants:100},{...base,codeInsee:'33003',votants:null}]});
 assert.equal((html.match(/class="distribution-bin"/g)||[]).length,10);
 for(const text of ['data-min="0" data-count="1"','data-min="90" data-count="1"','width:50%','width:0%','2 commune(s) admissible(s) · 1 ligne(s) exclue(s)','100 % inclus','sans pondération','Source fictive','2026-11-19'])assert.ok(html.includes(text),text);
});
test('histogramme : sélection requise, absence sans barre et source échappée',()=>{
 assert.match(render({year:''}),/Sélectionnez/);
 const html=render({rows:[{...base,votants:null}],meta:{source:'<source>'}});
 assert.match(html,/Aucune commune admissible/);assert.doesNotMatch(html,/distribution-bin|NaN/);
 assert.match(html,/&lt;source>/);
 const duplicates=render({rows:[base,base]});assert.ok(duplicates.includes('1 commune(s) en doublon'));
});
test('histogramme : année et périmètre sélectionnés ne mélangent pas la série historique',()=>{
 const html=render({rows:[base,{...base,annee:2020,votants:100},{...base,tour:'t2',votants:100}]});
 assert.ok(html.includes('data-min="0" data-count="1"'));assert.ok(html.includes('data-min="90" data-count="0"'));
});
