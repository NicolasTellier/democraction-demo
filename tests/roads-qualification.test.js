import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadRoads,searchRoads} from '../app/roads.js';
import {norm} from '../app/core.js';

const cases=[['33001','Chemin de la Communauté'],['33067','Allée du Docteur Abadie'],['33366','Allée de la Fontaine']];
test('GEO-QUAL-01a : trois paquets, recherche normalisée, ambiguïtés et cache mémoire',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../data/voies-manifest.json',import.meta.url),'utf8'));
 const original=globalThis.fetch,requests=[],report=[];
 globalThis.fetch=async url=>{
  const u=new URL(url);assert.equal(u.protocol,'file:','aucun service externe nécessaire');
  requests.push(u.pathname);
  const bytes=await readFile(u);
  return new Response(bytes,{status:200});
 };
 try{
  for(const [code,label] of cases){
   const row=manifest.communes.find(r=>r.code===code);
   const bytes=await readFile(new URL('../'+row.file,import.meta.url));
   assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256);
   const t=performance.now(),roads=await loadRoads(code),loadMs=performance.now()-t;
   assert.equal(roads.features.length,row.count);assert.match(roads.source,/paquet vérifié/);
   const before=JSON.stringify(roads),q=performance.now();
   const variants=[label,label.toUpperCase(),norm(label).toUpperCase()];
   const expected=searchRoads(roads,label).map(f=>f.properties.id);
   assert.ok(expected.length>0);
   for(const query of variants)assert.deepEqual(searchRoads(roads,query).map(f=>f.properties.id),expected);
   const ambiguous=searchRoads(roads,'rue');
   assert.ok(ambiguous.length>1);assert.ok(ambiguous.length<=40);
   assert.equal(new Set(ambiguous.map(f=>f.properties.id)).size,ambiguous.length);
   assert.ok(ambiguous.every(f=>norm(f.properties.name).includes('rue')));
   assert.equal(searchRoads(roads,'zzzz_geo_qual_introuvable_2026').length,0);
   const searchMs=performance.now()-q,count=requests.length,c=performance.now();
   assert.strictEqual(await loadRoads(code),roads);
   const memoryMs=performance.now()-c;
   assert.equal(requests.length,count,'cache mémoire sans nouvelle lecture');
   assert.equal(JSON.stringify(roads),before);
   report.push({code,count:row.count,bytes:bytes.length,loadMs,searchBatchMs:searchMs,memoryMs,ambiguousReturned:ambiguous.length,requestDelta:0});
  }
  assert.equal(requests.filter(p=>p.endsWith('voies-manifest.json')).length,1);
  assert.equal(requests.length,4);
  console.log('GEO-QUAL-01a NODE '+JSON.stringify({node:process.version,platform:process.platform,transport:'fichiers locaux via fetch adapté, sans réseau ni IndexedDB',report}));
 }finally{globalThis.fetch=original;}
});
