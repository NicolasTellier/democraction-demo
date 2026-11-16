import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeMissionCoverage} from '../app/logistics-coverage.js';

const communes=[
 {nom:'Zêta',codeInsee:'00003'},
 {nom:'Éloi-d’Aubrac',codeInsee:'00002'},
 {nom:'Alpha',codeInsee:'00001'},
];
const zero=()=>({total:0,todo:0,inProgress:0,completed:0,assigned:0,unassigned:0});
const noIgnored=()=>({cancelled:0,unknownStatus:0,unlocated:0,duplicateId:0,missingId:0});
const mission=(id,status='À faire',extra={})=>({id,campaignId:'campagne-recette',commune:'Alpha',status,...extra});
const summarize=(missions,extra={})=>summarizeMissionCoverage({communes,missions,campaignId:'campagne-recette',...extra});

function deepFreeze(value){
 if(value&&typeof value==='object'){
  for(const entry of Object.values(value))deepFreeze(entry);
  Object.freeze(value);
 }
 return value;
}

test('une mission multi-communes compte une fois par commune et une fois au global',()=>{
 const result=summarize([
  mission('mission-1','À faire',{commune:'  ALPHA ',zoneCommunes:['alpha','Éloi‑d’Aubrac'," ELOI-d'AUBRAC "],assignee:'Équipe fictive'}),
  mission('mission-2','En cours',{commune:'Lieu non reconnu',zoneCommunes:[' ZETA ','Alpha','zêta'],volunteers:['','Volontaire fictif']}),
  mission('mission-3','Terminée',{commune:'Éloi-d’Aubrac',assignee:'Équipe fictive'}),
 ]);
 assert.deepEqual(result.rows,[
  {codeInsee:'00001',commune:'Alpha',total:2,todo:1,inProgress:1,completed:0,assigned:2,unassigned:0},
  {codeInsee:'00002',commune:'Éloi-d’Aubrac',total:2,todo:1,inProgress:0,completed:1,assigned:1,unassigned:0},
  {codeInsee:'00003',commune:'Zêta',total:1,todo:0,inProgress:1,completed:0,assigned:1,unassigned:0},
 ]);
 assert.deepEqual(result.totals,{total:3,todo:1,inProgress:1,completed:1,assigned:2,unassigned:0});
 assert.deepEqual(result.ignored,noIgnored());
});

test('les autres campagnes ne contribuent ni aux compteurs ni aux identifiants déjà vus',()=>{
 const result=summarize([
  mission('partagé','Terminée',{campaignId:'autre-campagne',commune:'Zêta'}),
  mission('', 'Annulée',{campaignId:'autre-campagne'}),
  mission('hors-statut','Inconnu',{campaignId:'autre-campagne'}),
  mission('hors-lieu','À faire',{campaignId:'autre-campagne',commune:'Ailleurs'}),
  mission('sans-campagne','À faire',{campaignId:undefined}),
  mission('partagé','À faire'),
 ]);
 assert.deepEqual(result.totals,{total:1,todo:1,inProgress:0,completed:0,assigned:0,unassigned:1});
 assert.deepEqual(result.ignored,noIgnored());
});

test('annulations, statuts inconnus et missions sans commune reconnue restent exclus',()=>{
 const result=summarize([
  mission('annulée','Annulée'),
  mission('statut-inconnu','terminée'),
  mission('sans-lieu','À faire',{commune:'Lieu absent',zoneCommunes:['Autre lieu',' ']}),
  mission('lieu-secondaire','En cours',{commune:'Lieu absent',zoneCommunes:['Zêta']}),
 ]);
 assert.deepEqual(result.totals,{total:1,todo:0,inProgress:1,completed:0,assigned:0,unassigned:1});
 assert.deepEqual(result.ignored,{cancelled:1,unknownStatus:1,unlocated:1,duplicateId:0,missingId:0});
 assert.equal(result.rows.find(row=>row.codeInsee==='00003').inProgress,1);
});

test('les identifiants répétés gardent la première occurrence avant les exclusions',()=>{
 const result=summarize([
  mission('répétée','À faire'),
  mission('répétée','Terminée',{commune:'Zêta'}),
  mission('première-annulée','Annulée'),
  mission('première-annulée','À faire'),
  mission('première-inconnue','Autre'),
  mission('première-inconnue','À faire'),
  mission('première-sans-lieu','À faire',{commune:'Lieu absent'}),
  mission('première-sans-lieu','À faire'),
 ]);
 assert.deepEqual(result.totals,{total:1,todo:1,inProgress:0,completed:0,assigned:0,unassigned:1});
 assert.deepEqual(result.ignored,{cancelled:1,unknownStatus:1,unlocated:1,duplicateId:4,missingId:0});
});

test('les missions sans identifiant exploitable sont signalées dans la seule campagne choisie',()=>{
 const result=summarize([
  mission(undefined),mission(''),mission('  '),mission(7),
  mission(undefined,'À faire',{campaignId:'autre-campagne'}),
  mission('valide'),
 ]);
 assert.equal(result.totals.total,1);
 assert.deepEqual(result.ignored,{...noIgnored(),missingId:4});
});

test('une affectation explicite compte seulement pour les missions encore actives',()=>{
 const result=summarize([
  mission('sans-affectation','À faire',{assignee:'  '}),
  mission('équipe','À faire',{assignee:' Équipe fictive '}),
  mission('valeurs-vides','À faire',{assignee:7,volunteers:[' ',null,5,'']}),
  mission('volontaire','En cours',{volunteers:[' ','Volontaire fictif']}),
  mission('liste-invalide','En cours',{volunteers:'Volontaire fictif'}),
  mission('terminée','Terminée',{assignee:'Équipe fictive',volunteers:['Volontaire fictif']}),
 ]);
 assert.deepEqual(result.totals,{total:6,todo:3,inProgress:2,completed:1,assigned:2,unassigned:3});
 assert.equal(result.totals.assigned+result.totals.unassigned,result.totals.todo+result.totals.inProgress);
 assert.deepEqual(result.ignored,noIgnored());
});

test('sans mission, toutes les communes restent présentes avec des compteurs nuls',()=>{
 const result=summarize([]);
 assert.deepEqual(result.rows,communes.slice().sort((a,b)=>a.nom.localeCompare(b.nom,'fr')).map(c=>({codeInsee:c.codeInsee,commune:c.nom,...zero()})));
 assert.deepEqual(result.totals,zero());
 assert.deepEqual(result.ignored,noIgnored());
 assert.deepEqual(summarizeMissionCoverage(),{rows:[],totals:zero(),ignored:noIgnored()});
});

test('le calcul préserve les entrées gelées, leur ordre et leurs rattachements',()=>{
 const input=deepFreeze({communes:structuredClone(communes),missions:[
  mission('multi','En cours',{zoneCommunes:['Zêta','Alpha','zêta'],volunteers:['Volontaire fictif']}),
  mission('simple','Terminée',{commune:'Éloi-d’Aubrac'}),
 ],campaignId:'campagne-recette'});
 const before=structuredClone(input);
 const result=summarizeMissionCoverage(input);
 assert.deepEqual(input,before);
 assert.deepEqual(result,summarizeMissionCoverage(input));
 assert.deepEqual(input.communes.map(c=>c.codeInsee),['00003','00002','00001']);
 assert.deepEqual(input.missions[0].zoneCommunes,['Zêta','Alpha','zêta']);
});

test('une campagne absente ou de type différent ne révèle aucun compteur de mission',()=>{
 const missions=[mission('sans-campagne','À faire',{campaignId:undefined}),mission('numérique','À faire',{campaignId:7}),mission('valide')];
 for(const campaignId of [undefined,null,'', ' ',7]){
  const result=summarize(missions,{campaignId});
  assert.deepEqual(result.totals,zero());
  assert.deepEqual(result.ignored,noIgnored());
 }
});
