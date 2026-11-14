import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {classification,classIndex,validPolygon,validZone} from '../app/geo-utils.js';
import {emptyState,validateBackup} from '../app/core.js';

const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));

test('Les 87 contours correspondent aux 87 codes du référentiel',()=>{
 const geo=read('../data/communes-33-11.geojson'),territory=read('../data/territoire-33-11-2026.json');
 const codes=geo.features.map(f=>f.properties.code);
 assert.equal(new Set(codes).size,87);
 assert.deepEqual(new Set(codes),new Set(territory.communes.map(c=>c.codeInsee)));
 for(const feature of geo.features)assert.ok(validZone(feature.geometry),`Contour ${feature.properties.nom}`);
});

test('Un secteur conserve sa géométrie, ses rues et son identifiant à la restauration',()=>{
 const geometry={type:'Polygon',coordinates:[[[-0.5,45],[-0.4,45],[-0.4,45.1],[-0.5,45]]]};
 assert.equal(validPolygon(geometry),true);
 const state=emptyState();state.missions.push({id:'action-1',campaignId:state.current,title:'Marché',commune:'Saint-André-de-Cubzac',status:'À faire',zoneKind:'sector',zoneId:'secteur-7',zoneCommunes:['Saint-André-de-Cubzac'],zoneGeometry:geometry,rues:['Rue Nationale']});
 const restored=validateBackup(JSON.parse(JSON.stringify(state)));
 assert.equal(restored.missions[0].zoneId,'secteur-7');
 assert.deepEqual(restored.missions[0].zoneGeometry,geometry);
 assert.deepEqual(restored.missions[0].rues,['Rue Nationale']);
});

test('Les polygones croisés et les valeurs manquantes sont refusés',()=>{
 assert.equal(validPolygon({type:'Polygon',coordinates:[[[-.5,45],[-.4,45.1],[-.5,45.1],[-.4,45],[-.5,45]]]}),false);
 assert.equal(validPolygon({type:'Polygon',coordinates:[[[-.5,45],[-.45,45],[-.4,45],[-.4,45.1],[-.5,45.1],[-.5,45]]]}),true,'Un sommet inséré sur une arête reste valide');
 const legend=classification([null,12,30,50,90],{unit:'%',method:'fixed-percent'});
 assert.equal(classIndex(null,legend),-1);
 assert.equal(classIndex(80,legend),3);
 const income=classification([12000,18000,22000,36000],{unit:'€'});
 assert.deepEqual(income.breaks,[12000,18000,22000,36000]);
});
