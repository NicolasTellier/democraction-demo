import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeRoads,searchRoads,roadGeometry,loadAddressesForRoad,loadAddressesInBounds} from '../app/roads.js';
import {validZone} from '../app/geo-utils.js';
import {emptyState,validateBackup} from '../app/core.js';

const bundle=JSON.parse(readFileSync(new URL('../data/voies-33366.geojson',import.meta.url),'utf8'));

test('303 voies IGN géométriques et identifiants communaux exploitables',()=>{
 const features=normalizeRoads(bundle,'33366');
 assert.equal(features.length,303);
 assert.equal(new Set(features.map(f=>f.properties.id)).size,303);
 assert.ok(features.every(f=>validZone(f.geometry)&&f.properties.code==='33366'));
 assert.ok(searchRoads({features},'Élie Faure').some(f=>f.properties.name==='Rue Elie Faure'));
 assert.equal(searchRoads({features},'introuvable').length,0);
});

test('plusieurs rues forment une action linéaire sauvegardable sans perte',()=>{
 const features=normalizeRoads(bundle,'33366');
 const roads=['33366_0265','33366_0750'].map(id=>features.find(f=>f.properties.id===id));
 const geometry=roadGeometry(roads);
 assert.ok(validZone(geometry));
 const state=emptyState();
 state.missions.push({id:'test-voies',campaignId:state.current,title:'Tournée fictive',commune:'Saint-André-de-Cubzac',status:'À faire',zoneKind:'streets',zoneId:'33366',zoneCommunes:['Saint-André-de-Cubzac'],roadIds:roads.map(r=>r.properties.id),rues:roads.map(r=>r.properties.name),zoneGeometry:geometry});
 const restored=validateBackup(JSON.parse(JSON.stringify(state))).missions[0];
 assert.deepEqual(restored.roadIds,state.missions[0].roadIds);
 assert.deepEqual(restored.zoneGeometry,geometry);
 state.missions[0].roadIds=['bad',42];
 assert.throws(()=>validateBackup(state),/Voies de mission invalides/);
});

test('adresses BAN : recherche par nom quand le code de voie ne correspond pas',async()=>{
 const original=globalThis.fetch,queries=[];
 globalThis.fetch=async url=>{
  const filter=new URL(url).searchParams.get('CQL_FILTER');queries.push(filter);
  const features=filter.includes('nom_voie=')?[{type:'Feature',geometry:{type:'Point',coordinates:[-.4332,44.9985]},properties:{id:'test_adresse_1',code_insee:'33366',numero:'2',nom_commune:'Saint-André-de-Cubzac',code_postal:'33240'}}]:[];
  return {ok:true,json:async()=>({type:'FeatureCollection',numberMatched:features.length,features})};
 };
 try{
  const result=await loadAddressesForRoad({properties:{id:'33366_9999',code:'33366',name:'Rue fictive'}});
  assert.equal(result.features.length,1);
  assert.equal(result.features[0].roadName,'Rue fictive');
  assert.match(queries[0],/id_fantoir=/);
  assert.match(queries[1],/nom_voie=/);
 }finally{globalThis.fetch=original}
});

test('points BAN : petite emprise et commune filtrées, pagination bornée et points étrangers écartés',async()=>{
 const original=globalThis.fetch,queries=[];
 globalThis.fetch=async url=>{
  const params=new URL(url).searchParams;queries.push(params);
  const start=Number(params.get('STARTINDEX'));
  const feature=(id,code,coordinates)=>({type:'Feature',geometry:{type:'Point',coordinates},properties:{id,code_insee:code,nom_voie:'Rue test',numero:2,code_postal:'33240',nom_commune:'Saint-André-de-Cubzac'}});
  const features=start? [feature('ban-251','33366',[-.419,44.976])]:Array.from({length:250},(_,i)=>feature(`ban-${i}`,'33366',[-.419,44.976]));
  if(start)features.push(feature('hors-commune','33001',[-.419,44.976]),feature('hors-emprise','33366',[-.5,44.976]));
  return {ok:true,json:async()=>({type:'FeatureCollection',numberMatched:253,features})};
 };
 try{
  const bounds={west:-.42,south:44.975,east:-.418,north:44.977};
  const result=await loadAddressesInBounds('33366',bounds);
  assert.equal(result.features.length,251);
  assert.equal(result.features[0].roadName,'Rue test');
  assert.equal(queries.length,2);
  assert.match(queries[0].get('CQL_FILTER'),/code_insee='33366' AND BBOX\(geom,-0\.42,44\.975,-0\.418,44\.977,'EPSG:4326'\)/);
  assert.equal(queries[0].get('BBOX'),null);
  assert.equal(queries[0].get('SORTBY'),'id');
  assert.equal(queries[1].get('STARTINDEX'),'250');
  await assert.rejects(loadAddressesInBounds('33366',{...bounds,east:-.3}),/Zoomez davantage/);
 }finally{globalThis.fetch=original}
});
