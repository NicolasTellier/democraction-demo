import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
test.use({serviceWorkers:'block'});
const profiles=[
 {name:'local',latency:0,downloadThroughput:-1,uploadThroughput:-1,connectionType:'ethernet'},
 {name:'contraint',latency:150,downloadThroughput:128000,uploadThroughput:64000,connectionType:'cellular3g'}
];
const cases=[
 {code:'33001',name:'Abzac',count:99,label:'Chemin de la Communauté',plain:'CHEMIN DE LA COMMUNAUTE',ambiguous:40},
 {code:'33067',name:'Bourg',count:179,label:'Allée du Docteur Abadie',plain:'ALLEE DU DOCTEUR ABADIE',ambiguous:39},
 {code:'33366',name:'Saint-André-de-Cubzac',count:303,label:'Allée de la Fontaine',plain:'ALLEE DE LA FONTAINE',ambiguous:40}
];
for(const profile of profiles)test('GEO-QUAL-01c : parcours visuel sous profil '+profile.name,async({page,context},info)=>{
 test.setTimeout(120000);
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64');
 let roadWfs=0;
 // Isoler les vecteurs : fond transparent et réponses BAN vides ; aucune voie WFS substituée.
 await page.route('https://data.geopf.fr/**',route=>{
  const u=new URL(route.request().url());
  if(u.pathname.includes('wmts'))return route.fulfill({status:200,contentType:'image/png',body:png});
  if(u.searchParams.get('TYPENAMES')==='BDTOPO_V3:voie_nommee')roadWfs++;
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({type:'FeatureCollection',numberMatched:0,features:[]})});
 });
 await page.goto('/');
 await page.locator('button[data-nav=carte]:visible').first().click();
 await expect(page.locator('#map.leaflet-container')).toBeVisible({timeout:20000});
 const cdp=await context.newCDPSession(page);
 await cdp.send('Network.enable');
 await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 await cdp.send('Network.emulateNetworkConditions',{offline:false,...Object.fromEntries(Object.entries(profile).filter(([k])=>k!=='name'))});
 await page.evaluate(()=>performance.clearResourceTimings());
 const now=()=>page.evaluate(()=>performance.now());
 const paint=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
 const rows=[];
 for(const row of cases){
  await page.locator('#map-scope').selectOption('commune');
  const start=await now();
  await page.locator('#map-scope-value').selectOption(row.name);
  await expect(page.locator('.map-rail')).toContainText(row.count+' voies linéaires',{timeout:30000});
  await expect.poll(()=>page.locator('#map .road-line').count(),{timeout:30000}).toBeGreaterThanOrEqual(row.count);
  await paint();
  const loadAndRenderMs=await now()-start;
  await expect(page.locator('.street-chip')).toHaveCount(0);
  await expect(page.locator('#street-search-form [name=commune]')).toHaveValue(row.name);
  const search=async query=>{
   await page.locator('#street-search-form [name=query]').fill(query);
   await page.locator('#street-search-form button').click();
  };
  const q=await now();await search('rue');
  await expect(page.locator('.street-result')).toHaveCount(row.ambiguous);
  await expect(page.locator('.street-chip')).toHaveCount(0);
  await paint();const ambiguousSearchMs=await now()-q;
  await search(row.label);
  await expect(page.locator('.street-result')).toHaveCount(1);
  const initial=await page.locator('.street-result strong').allTextContents();
  await search(row.plain);
  await expect(page.locator('.street-result')).toHaveCount(1);
  await expect(page.locator('.street-result strong')).toHaveText(initial);
  const select=await now();
  if(['iphone','android'].includes(info.project.name))await page.locator('.street-result').tap();
  else await page.locator('.street-result').click();
  await expect(page.locator('.street-chip')).toHaveCount(1);
  await expect(page.locator('.street-chip')).toContainText(row.label);
  await expect.poll(()=>page.locator('#map .road-selected').count(),{timeout:30000}).toBeGreaterThan(0);
  await paint();const selectionAndPaintMs=await now()-select;
  await expect(page.locator('[data-action=new-mission-from-map]')).toHaveCount(0);
  await expect(page.locator('.map-rail')).toContainText('Les rues sélectionnées sont surlignées pour consultation.');
  if(row.code==='33366'&&['desktop','iphone'].includes(info.project.name)){
   mkdirSync('test-results/captures',{recursive:true});
   await page.locator('.map-rail section').filter({has:page.locator('#street-search-form')}).screenshot({path:'test-results/captures/voies-visuel-recherche-'+profile.name+'-'+info.project.name+'.png'});
   await page.locator('#map').screenshot({path:'test-results/captures/voies-visuel-carte-'+profile.name+'-'+info.project.name+'.png'});
  }
  await search('zzzz_geo_qual_introuvable_2026');
  await expect(page.locator('.street-result')).toHaveCount(0);
  await expect(page.locator('.map-rail')).toContainText('Aucune rue trouvée');
  await expect(page.locator('.street-chip')).toHaveCount(1);
  const resources=await page.evaluate(code=>performance.getEntriesByType('resource').filter(r=>r.name.includes('voies-'+code+'.geojson.gz')).map(r=>({duration:r.duration,transferSize:r.transferSize,encodedBodySize:r.encodedBodySize})),row.code);
  expect(resources).toHaveLength(1);
  rows.push({code:row.code,count:row.count,loadAndRenderMs,ambiguousSearchMs,selectionAndPaintMs,resources});
 }
 expect(roadWfs).toBe(0);
 console.log('GEO-QUAL-01c VISUAL '+JSON.stringify({project:info.project.name,profile,rows,scope:'CDP après ouverture de la carte ; paquets locaux réels, fond transparent, BAN vide, deux requestAnimationFrame ; temps de pilotage inclus, sans seuil SLA'}));
 await cdp.detach();
});
