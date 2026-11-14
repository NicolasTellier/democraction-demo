import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extractKmlFromKmz,validateBureauImport,readBureauFile} from '../app/bureau-import.js';

const bytes=readFileSync(new URL('./fixtures/bureau.kmz',import.meta.url));
const kml=readFileSync(new URL('./fixtures/bureau.kml',import.meta.url),'utf8');
const communes=JSON.parse(readFileSync(new URL('../data/territoire-33-11-2026.json',import.meta.url))).communes;

test('KMZ réel compressé : extraction intégrale et CRC contrôlé',async()=>{
  assert.equal(await extractKmlFromKmz(bytes),kml);
  const tampered=Uint8Array.from(bytes);
  tampered[50]^=1;
  await assert.rejects(extractKmlFromKmz(tampered));
});

test('lecture KMZ et contrôle des géométries, identifiants et provenance',async()=>{
  const file=new File([bytes],'bureau.kmz',{type:'application/vnd.google-earth.kmz'});
  // DOMParser est volontairement testé dans le vrai navigateur ci-dessous.
  await assert.rejects(readBureauFile(file,communes,{commune:'Saint-André-de-Cubzac'}),/Lecture KML indisponible/);
  const rectangle={type:'Polygon',coordinates:[[[-.49,45.02],[-.47,45.02],[-.47,45.04],[-.49,45.04],[-.49,45.02]]]};
  const valid=validateBureauImport({type:'FeatureCollection',features:[{type:'Feature',properties:{id:'33366-1',codeInsee:'33366',nom:'Bureau 1'},geometry:rectangle}]},communes,{source:'Carte transmise localement',fileName:'bureau.geojson',importedAt:'2026-11-14T10:00:00Z'});
  assert.equal(valid.features[0].properties.source,'Carte transmise localement');
  assert.equal(valid.features[0].properties.validationStatus,'À confirmer');
  assert.equal(valid.features[0].properties.importedAt,'2026-11-14T10:00:00Z');
  assert.deepEqual(validateBureauImport(valid,communes).features[0].properties,valid.features[0].properties);
  assert.throws(()=>validateBureauImport({type:'FeatureCollection',features:[{type:'Feature',properties:{id:'33366-1',codeInsee:'33366'},geometry:{type:'LineString',coordinates:[[-.49,45.02],[-.47,45.02]]}}]},communes),/contour de bureau invalide/);
  assert.throws(()=>validateBureauImport(valid,communes,{commune:'Bourg'}),/Commune du contour/);
});
