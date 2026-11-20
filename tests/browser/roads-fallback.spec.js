import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});
test('GEO-QUAL-01b : copies récente/périmée, absence, renouvellement et annulation',async({page})=>{
 test.setTimeout(60000);let wfs=0,serve=false;
 const feature=code=>({type:'Feature',properties:{id:code+'_fictif',name:'Voie fictive de recette',code},geometry:{type:'LineString',coordinates:[[-.1,45],[-.101,45.001]]}});
 await page.route('**/data/voies-33*.geojson.gz',route=>route.fulfill({status:404}));
 await page.route('https://data.geopf.fr/wfs/ows**',route=>{
  wfs++;if(!serve)return route.fulfill({status:503});
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({type:'FeatureCollection',numberMatched:1,features:[feature('33366')]})});
 });
 await page.goto('/');
 await page.evaluate(async()=>{
  const {writeRoadCache,ROAD_CACHE_AGE_MS}=await import('/app/road-cache.js');
  const feature=code=>({type:'Feature',properties:{id:code+'_fictif',name:'Voie fictive de recette',code},geometry:{type:'LineString',coordinates:[[-.1,45],[-.101,45.001]]}});
  for(const [code,age] of [['33001',1000],['33067',ROAD_CACHE_AGE_MS+86400000]])
   await writeRoadCache({code,features:[feature(code)],matched:1,source:'Jeu fictif GEO-QUAL-01b',asOf:new Date(Date.now()-age).toISOString()});
 });
 await page.reload();
 const recent=await page.evaluate(async()=>{const {loadRoads}=await import('/app/roads.js');return loadRoads('33001');});
 expect(recent.cached).toBe(true);expect(recent.stale).toBeUndefined();expect(recent.features).toHaveLength(1);expect(recent.features[0].properties.name).toBe('Voie fictive de recette');expect(wfs).toBe(0);
 const stale=await page.evaluate(async()=>{const {loadRoads}=await import('/app/roads.js');return loadRoads('33067');});
 expect(stale.cached).toBe(true);expect(stale.stale).toBe(true);expect(stale.source).toContain('ancienne');expect(stale.features).toHaveLength(1);expect(wfs).toBe(1);
 const missing=await page.evaluate(async()=>{try{const {loadRoads}=await import('/app/roads.js');await loadRoads('33366');return 'unexpected';}catch(e){return e.message;}});
 expect(missing).toContain('503');expect(wfs).toBe(2);
 serve=true;
 const renewed=await page.evaluate(async()=>{const {loadRoads}=await import('/app/roads.js');const {readRoadCache}=await import('/app/road-cache.js');const roads=await loadRoads('33366');return {roads,saved:await readRoadCache('33366')};});
 expect(renewed.roads.stored).toBe(true);expect(renewed.roads.source).toContain('WFS');expect(renewed.saved.features).toHaveLength(1);expect(wfs).toBe(3);
 serve=false;await page.reload();
 const saved=await page.evaluate(async()=>{const {loadRoads}=await import('/app/roads.js');return loadRoads('33366');});
 expect(saved.cached).toBe(true);expect(saved.stale).toBeUndefined();expect(saved.features).toHaveLength(1);expect(wfs).toBe(3);
 const cancelled=await page.evaluate(async()=>{
  const {loadRoads}=await import('/app/roads.js?annulation-geo-qual-01b');
  const original=window.fetch,controller=new AbortController();let packages=0;
  window.fetch=async(url,options)=>{if(String(url).includes('voies-33001.geojson.gz')){packages++;controller.abort();throw controller.signal.reason;}return original(url,options);};
  try{await loadRoads('33001',{signal:controller.signal});return {name:'unexpected',packages};}catch(e){return {name:e.name,packages};}finally{window.fetch=original;}
 });
 expect(cancelled).toEqual({name:'AbortError',packages:1});expect(wfs).toBe(3);
 // La copie reste consultable par un nouvel appel explicitement non annulé.
 const after=await page.evaluate(async()=>{const {loadRoads}=await import('/app/roads.js?annulation-geo-qual-01b');return loadRoads('33001');});
 expect(after.cached).toBe(true);expect(after.features).toHaveLength(1);expect(wfs).toBe(3);
});
