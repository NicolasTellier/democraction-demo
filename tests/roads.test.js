import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeRoads,searchRoads,roadGeometry} from '../app/roads.js';
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
