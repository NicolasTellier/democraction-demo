import test from 'node:test';
import assert from 'node:assert/strict';
const code='33001';
const feature={type:'Feature',properties:{id:'33001_test',name:'Rue fictive',code},geometry:{type:'LineString',coordinates:[[-.1,45],[-.101,45.001]]}};
const collection={type:'FeatureCollection',meta:{commune:code},features:[feature],numberMatched:1};
const manifest={communes:[{code,file:'data/voies-33001.geojson',count:1,matched:1,asOf:'2026-11-20T00:00:00Z'}]};
let serial=0;
async function scenario(run,respond){
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async(url,options)=>{const kind=String(url).includes('voies-manifest')?'manifest':String(url).includes('/wfs/')?'wfs':'package';calls.push(kind);return respond(kind,options);};
 try{const roads=await import('../app/roads.js?fallback='+ ++serial);await run(roads,calls);}finally{globalThis.fetch=original;}
}
const json=data=>new Response(JSON.stringify(data),{status:200});

test('paquet de mauvaise commune refusé avant repli WFS',async()=>{
 await scenario(async({loadRoads},calls)=>{const result=await loadRoads(code);assert.match(result.source,/WFS/);assert.equal(result.features.length,1);assert.deepEqual(calls,['manifest','package','wfs']);},
 kind=>json(kind==='manifest'?manifest:kind==='package'?{...collection,meta:{commune:'33067'}}:collection));
});
test('géométrie de paquet invalide écartée et remplacée par WFS',async()=>{
 await scenario(async({loadRoads})=>{const result=await loadRoads(code);assert.match(result.source,/WFS/);assert.equal(result.features[0].geometry.type,'LineString');},
 kind=>json(kind==='manifest'?manifest:kind==='package'?{...collection,features:[{...feature,geometry:{type:'Point',coordinates:[-.1,45]}}]}:collection));
});
test('annulation avant premier appel : aucune lecture',async()=>{
 const controller=new AbortController();controller.abort();
 await scenario(async({loadRoads},calls)=>{await assert.rejects(loadRoads(code,{signal:controller.signal}),{name:'AbortError'});assert.deepEqual(calls,[]);},kind=>json(kind==='manifest'?manifest:collection));
});
test('annulation avec mémoire déjà chaude reste une annulation',async()=>{
 await scenario(async({loadRoads},calls)=>{await loadRoads(code);const n=calls.length,controller=new AbortController();controller.abort();await assert.rejects(loadRoads(code,{signal:controller.signal}),{name:'AbortError'});assert.equal(calls.length,n);},kind=>json(kind==='manifest'?manifest:collection));
});
test('annulation pendant manifeste : pas de paquet ni WFS',async()=>{
 const controller=new AbortController();
 await scenario(async({loadRoads},calls)=>{await assert.rejects(loadRoads(code,{signal:controller.signal}),{name:'AbortError'});assert.deepEqual(calls,['manifest']);},kind=>{controller.abort();return json(manifest);});
});
test('annulation du paquet : pas de secours ni résultat mis en mémoire',async()=>{
 const controller=new AbortController();let first=true;
 await scenario(async({loadRoads},calls)=>{
  await assert.rejects(loadRoads(code,{signal:controller.signal}),{name:'AbortError'});assert.deepEqual(calls,['manifest','package']);
  const result=await loadRoads(code);assert.match(result.source,/paquet vérifié/);assert.deepEqual(calls,['manifest','package','package']);
 },kind=>{if(kind==='manifest')return json(manifest);if(first){first=false;controller.abort();throw controller.signal.reason;}return json(collection);});
});
test('sans copie, erreur WFS propagée puis nouvel essai indépendant',async()=>{
 let fail=true;
 await scenario(async({loadRoads},calls)=>{await assert.rejects(loadRoads(code),/Service IGN indisponible \(503\)/);fail=false;const result=await loadRoads(code);assert.match(result.source,/WFS/);assert.equal(calls.filter(k=>k==='wfs').length,2);},
 kind=>kind==='manifest'?json(manifest):kind==='package'?new Response('',{status:404}):fail?new Response('',{status:503}):json(collection));
});
test('réponse vide WFS sans copie : aucun tracé inventé',async()=>{
 await scenario(async({loadRoads})=>{await assert.rejects(loadRoads(code),/Aucune géométrie linéaire/);},kind=>kind==='manifest'?json(manifest):kind==='package'?new Response('',{status:404}):json({type:'FeatureCollection',features:[],numberMatched:0}));
});
