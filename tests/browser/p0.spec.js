import {openManualMission, seedLegacyGeometryMission} from '../helpers/mission-simulation.js';
import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test.beforeEach(async({page})=>{
 page.on('pageerror',error=>console.error('Erreur navigateur:',error.message));
 page.on('console',message=>{if(message.type()==='error')console.error('Console navigateur:',message.text())});
});

test('polygones, échelle et sélection conservés après rechargement',async({page})=>{
 await page.goto('/');
 await page.locator('button[data-nav=carte]:visible').first().click();
 await expect.poll(()=>page.locator('#map .leaflet-interactive').count(),{timeout:20000}).toBeGreaterThanOrEqual(87);
 await expect(page.locator('#map .map-legend')).toContainText('Participation électorale');
 await page.locator('#map-scope-value').selectOption('Saint-André-de-Cubzac');
 await expect(page.locator('.map-selection-summary')).toContainText('Saint-André-de-Cubzac');
 await expect.poll(()=>page.locator('#map .leaflet-interactive').count(),{timeout:20000}).toBeGreaterThanOrEqual(87);
 await page.locator('#map-scope').selectOption('epci');
 await page.locator('#map-scope-value').selectOption({label:'Grand Cubzaguais'});
 await expect(page.locator('.map-selection-summary')).toContainText('16 commune(s)');
 await expect(page.locator('.map-detail .panel')).toContainText('Population Insee 2023');
 await expect.poll(()=>page.locator('#map .leaflet-interactive').count(),{timeout:20000}).toBeGreaterThanOrEqual(87);
 await page.locator('#map-scope').selectOption('canton');
 await page.locator('#map-scope-value').selectOption({label:'Le Nord-Gironde'});
 await expect(page.locator('.map-selection-summary')).toContainText('24 commune(s)');
 await expect(page.locator('.map-detail .panel')).toContainText('Canton · Le Nord-Gironde');
 await page.locator('#map-layer').selectOption('revenuMedian');
 await expect(page.locator('#map .map-legend')).toContainText('€');
 await expect(page.locator('#map .map-legend')).toContainText('Insee');
 await page.reload();
 await page.locator('button[data-nav=carte]:visible').first().click();
 await expect.poll(()=>page.locator('#map .leaflet-interactive').count(),{timeout:20000}).toBeGreaterThanOrEqual(87);
 await expect(page.locator('#map-layer')).toHaveValue('revenuMedian');
});

test('les formulaires de démonstration ne gardent que des exemples anonymes',async({page},testInfo)=>{
 test.skip(['iphone','android'].includes(testInfo.project.name),'Navigation contacts réservée à la version desktop du prototype');
 await page.goto('/');
 await page.getByRole('button',{name:'Contacts fictifs'}).click();
 await page.locator('#contact-form [name=context]').selectOption('Marché');
 await page.locator('#contact-form button[type=submit]').click();
 await expect(page.getByText('Contact fictif 1')).toBeVisible();
 await page.getByRole('button',{name:'Événements publics'}).click();
 await page.locator('#event-form [name=title]').fill('Atelier fictif');
 await page.locator('#event-form [name=commune]').fill('Bourg');
 await page.locator('#event-form [name=date]').fill('2026-12-20T15:00');
 await page.locator('#event-form [name=capacity]').fill('2');
 await page.locator('#event-form [name=description]').fill('Simulation');
 await page.locator('#event-form button[type=submit]').click();
 await page.locator('.event-register-form button[type=submit]').click();
 await expect(page.getByText('1/2 place(s)')).toBeVisible();
 await page.reload();
 await page.getByRole('button',{name:'Événements publics'}).click();
 await expect(page.getByText('1/2 place(s)')).toBeVisible();
});

test('comparaison de deux scrutins identifiés avec cartes et écarts',async({page})=>{
 await page.goto('/');
 await page.locator('button[data-nav=carte]:visible').first().click();
 await page.locator('button[data-map-mode=compare]').click();
 await expect(page.locator('#compare-left')).toHaveValue('2026_muni_t1');
 await expect(page.locator('#compare-right')).toHaveValue('2020_muni_t1');
 await expect.poll(()=>page.locator('.compare-maps .leaflet-container').count(),{timeout:20000}).toBe(2);
 await expect.poll(()=>page.locator('.compare-maps .leaflet-interactive').count(),{timeout:20000}).toBeGreaterThanOrEqual(174);
 await expect(page.locator('.map-compare-table')).toContainText('Municipales 2026');
 await expect(page.locator('.map-compare-table')).toContainText('Municipales 2020');
 await expect(page.locator('.map-compare-table tbody tr')).toHaveCount(87);
});

test('secteur dessiné, édition et action géométrique préexistante conservés au rechargement',async({page},testInfo)=>{
 test.skip(['iphone','android'].includes(testInfo.project.name),'Le parcours complet de dessin au doigt requiert une recette manuelle mobile');
 await page.goto('/');
 await page.locator('button[data-nav=carte]:visible').first().click();
 await page.locator('#map-scope-value').selectOption({label:'Saint-André-de-Cubzac'});
 await page.locator('button[data-map-mode=draw]').click();
 await expect.poll(()=>page.locator('#map.leaflet-container').count(),{timeout:20000}).toBe(1);
 await page.locator('#sector-name').fill('Secteur test');
 await page.locator('[data-map-draw-start]').click();
 for(const point of [{x:170,y:140},{x:215,y:140},{x:210,y:185},{x:165,y:190}])
  await page.locator('#map').click({position:point});
 await expect(page.locator('#map .sector-vertex')).toHaveCount(4);
 await page.locator('[data-map-draw-finish]').click();
 await expect(page.locator('.map-selection-summary')).toContainText('Secteur test');
 const sector=await page.evaluate(()=>JSON.parse(localStorage.getItem('democraction-demo-sectors')).find(s=>s.name==='Secteur test'));
 expect(sector.geometry.coordinates[0]).toHaveLength(5);
 await page.locator(`[data-sector-edit="${sector.id}"]`).click();
 await expect(page.locator('#sector-name')).toHaveValue('Secteur test');
 await page.locator('#sector-name').fill('Secteur test modifié');
 await expect.poll(()=>page.locator('#map .sector-midpoint').count(),{timeout:20000}).toBeGreaterThanOrEqual(4);
 await page.locator('#map .sector-midpoint').first().click();
 await page.locator('[data-map-draw-finish]').click();
 const edited=await page.evaluate(id=>JSON.parse(localStorage.getItem('democraction-demo-sectors')).find(s=>s.id===id),sector.id);
 expect(edited.name).toBe('Secteur test modifié');
 expect(edited.geometry.coordinates[0]).toHaveLength(6);
 await expect(page.locator('[data-action=new-mission-from-map]')).toHaveCount(0);
 await seedLegacyGeometryMission(page,{title:'Action sur secteur test',zoneKind:'sector',zoneId:sector.id,zoneGeometry:edited.geometry});
 const mission=await page.evaluate(id=>JSON.parse(localStorage.getItem('democraction-v1-local')).missions.find(m=>m.zoneId===id),sector.id);
 expect(mission.zoneKind).toBe('sector');
 expect(mission.zoneGeometry).toEqual(edited.geometry);
 await page.locator('button[data-nav=actions]:visible').first().click();
 await page.locator(`[data-edit-mission="${mission.id}"]`).click();
 await page.locator('#mission-form [name=status]').selectOption('En cours');
 await page.locator('#mission-form button[type=submit]').click();
 await expect(page.getByText('Action sur secteur test')).toBeVisible();
 await page.locator('button[data-nav=carte]:visible').first().click();
 await expect.poll(()=>page.locator('#map .leaflet-interactive[stroke="#ee4b23"]').count(),{timeout:20000}).toBeGreaterThanOrEqual(1);
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('button[data-action=backup]').first().click()]);
 const backup=JSON.parse(await readFile(await download.path(),'utf8'));
 expect(backup.sectors.find(s=>s.id===sector.id)?.geometry).toEqual(edited.geometry);
 expect(backup.application.missions.find(m=>m.zoneId===sector.id)?.title).toBe('Action sur secteur test');
 page.once('dialog',dialog=>dialog.accept());
 await page.locator(`[data-sector-delete="${sector.id}"]`).click();
 await expect(page.locator(`[data-sector-select="${sector.id}"]`)).toHaveCount(0);
 await page.locator('button[data-nav=imports]:visible').first().click();
 page.once('dialog',dialog=>dialog.accept());
 // La lecture de fichier est asynchrone : contrôler son achèvement avant reload.
 // Une promesse explicite reproduit une lecture lente sans délai arbitraire.
 await page.evaluate(()=>{
  const original=File.prototype.text;
  window.__restoreReadStarted=false;
  File.prototype.text=async function(...args){
   if(this.name==='recette.json'){
    window.__restoreReadStarted=true;
    await new Promise(resolve=>{window.__releaseRestoreRead=resolve;});
    File.prototype.text=original;
   }
   return original.apply(this,args);
  };
 });
 await page.locator('#restore-backup').setInputFiles({name:'recette.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
 await expect.poll(()=>page.evaluate(()=>window.__restoreReadStarted)).toBe(true);
 await expect(page.locator('.notice[role=status]').filter({hasText:'Sauvegarde et secteurs restaurés.'})).toHaveCount(0);
 expect(await page.evaluate(id=>JSON.parse(localStorage.getItem('democraction-demo-sectors')).some(s=>s.id===id),sector.id)).toBe(false);
 await page.evaluate(()=>window.__releaseRestoreRead());
 await expect(page.locator('.notice[role=status]').filter({hasText:'Sauvegarde et secteurs restaurés.'})).toBeVisible();
 await expect.poll(()=>page.evaluate(({sectorId,missionId})=>{
  const restored=JSON.parse(localStorage.getItem('democraction-demo-sectors')).find(s=>s.id===sectorId);
  const restoredMission=JSON.parse(localStorage.getItem('democraction-v1-local')).missions.find(m=>m.id===missionId);
  return {name:restored?.name,geometry:restored?.geometry,title:restoredMission?.title,status:restoredMission?.status};
 },{sectorId:sector.id,missionId:mission.id})).toEqual({name:'Secteur test modifié',geometry:edited.geometry,title:'Action sur secteur test',status:'En cours'});
 await page.reload();
 await page.locator('button[data-nav=carte]:visible').first().click();
 await expect(page.locator(`[data-sector-select="${sector.id}"]`)).toContainText('Secteur test modifié');
 await page.locator('button[data-nav=actions]:visible').first().click();
 await expect(page.getByText('Action sur secteur test')).toBeVisible();
});

test('un contour de bureau importé est sélectionnable et visible',async({page})=>{
 await page.goto('/');
 await page.locator('button[data-nav=carte]:visible').first().click();
 await page.locator('#map-scope').selectOption('bureau');
 const feature={type:'FeatureCollection',features:[{type:'Feature',properties:{id:'B-TEST',nom:'Bureau de recette',codeInsee:'33366'},geometry:{type:'Polygon',coordinates:[[[-0.49,45.02],[-0.47,45.02],[-0.47,45.04],[-0.49,45.04],[-0.49,45.02]]]}}]};
 await page.locator('#bureau-import').setInputFiles({name:'bureau-test.geojson',mimeType:'application/geo+json',buffer:Buffer.from(JSON.stringify(feature))});
 await page.locator('#map-scope-value').selectOption('B-TEST');
 await expect(page.locator('.map-selection-summary')).toContainText('Bureau de vote');
 await expect(page.locator('.map-detail .panel')).toContainText('Bureau de recette');
 await expect.poll(()=>page.locator('#map .leaflet-interactive[stroke="#ee4b23"]').count(),{timeout:20000}).toBeGreaterThanOrEqual(1);
});
