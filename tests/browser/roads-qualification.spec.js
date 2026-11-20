import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});

test('GEO-QUAL-01a : trois communes, copie IndexedDB et relecture après rechargement',async({page},info)=>{
 test.setTimeout(60000);
 const loaded=[],wfs=[];
 page.on('request',r=>{if(/voies-33\d{3}\.geojson\.gz/.test(r.url()))loaded.push(r.url());if(r.url().includes('data.geopf.fr/wfs/ows'))wfs.push(r.url());});
 await page.goto('/');
 const first=await page.evaluate(async()=>{
  const {loadRoads,searchRoads}=await import('/app/roads.js');
  const {writeRoadCache,readRoadCache}=await import('/app/road-cache.js');
  const cases=[['33001','Chemin de la Communauté',99],['33067','Allée du Docteur Abadie',179],['33366','Allée de la Fontaine',303]],report=[];
  for(const [code,label,count] of cases){
   const t=performance.now(),roads=await loadRoads(code),loadMs=performance.now()-t;
   const normal=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
   const q=performance.now(),ids=searchRoads(roads,label).map(f=>f.properties.id);
   const variant=searchRoads(roads,normal(label)).map(f=>f.properties.id);
   const ambiguous=searchRoads(roads,'rue').length,missing=searchRoads(roads,'zzzz_geo_qual_introuvable_2026').length,searchMs=performance.now()-q;
   const m=performance.now(),same=await loadRoads(code)===roads,memoryMs=performance.now()-m;
   // Les paquets ne sont pas écrits automatiquement en IndexedDB. Amorçage explicite de la copie pour qualifier son chemin de secours.
   const c=performance.now();await writeRoadCache(roads);const saved=await readRoadCache(code),writeReadMs=performance.now()-c;
   report.push({code,count,actual:roads.features.length,ids,variant,ambiguous,missing,same,loadMs,searchMs,memoryMs,writeReadMs,savedCount:saved.features.length,source:roads.source});
  }
  return report;
 });
 for(const row of first){expect(row.actual).toBe(row.count);expect(row.savedCount).toBe(row.count);expect(row.ids.length).toBeGreaterThan(0);expect(row.variant).toEqual(row.ids);expect(row.ambiguous).toBeGreaterThan(1);expect(row.missing).toBe(0);expect(row.same).toBe(true);expect(row.source).toContain('paquet vérifié');}
 // Nouveau document : la Map mémoire précédente ne peut pas fournir ces objets.
 await page.route('**/data/voies-33*.geojson.gz',route=>route.fulfill({status:404}));
 await page.reload();
 const restored=await page.evaluate(async()=>{
  const {loadRoads,searchRoads}=await import('/app/roads.js'),rows=[];
  for(const code of ['33001','33067','33366']){
   const t=performance.now(),roads=await loadRoads(code);
   rows.push({code,count:roads.features.length,cached:roads.cached,source:roads.source,stale:!!roads.stale,loadMs:performance.now()-t,missing:searchRoads(roads,'zzzz_geo_qual_introuvable_2026').length});
  }
  return rows;
 });
 for(let i=0;i<restored.length;i++){expect(restored[i].count).toBe(first[i].count);expect(restored[i].cached).toBe(true);expect(restored[i].stale).toBe(false);expect(restored[i].source).toContain('copie locale');expect(restored[i].missing).toBe(0);}
 expect(wfs).toHaveLength(0);
 expect(loaded.filter(u=>/voies-(33001|33067|33366)\.geojson\.gz/.test(u)).length).toBeGreaterThanOrEqual(6);
 console.log('GEO-QUAL-01a BROWSER '+JSON.stringify({project:info.project.name,browser:info.project.use.browserName,transport:'serveur HTTP local CI, paquet puis 404 contrôlé, IndexedDB amorcée explicitement',first,restored}));
});
