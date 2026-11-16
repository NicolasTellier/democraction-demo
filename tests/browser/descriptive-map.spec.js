import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {emptyState} from '../../app/core.js';

test.use({serviceWorkers:'block'});

const PREFS_KEY='democraction-demo-preferences';
const APP_KEY='democraction-v1-local';
const COMMUNE='Saint-André-de-Cubzac';
const RETIRED_KEYS=['prioritySocio','priorityElectoralWeight','prioritySocioWeight'];
const legacyPreferences=()=>({
 filters:{commune:COMMUNE,query:'Cubzac',mapLayer:'priority',prioritySocio:'tauxChomage',priorityElectoralWeight:'80',prioritySocioWeight:'20',analysisCommuneCodes:['33366']},
 mapSelection:{kind:'commune',value:COMMUNE},mapMode:'explore',
});

async function openMap(page){
 await page.locator('button[data-nav=carte]:visible').first().click();
 await expect(page.locator('#map-layer')).toBeVisible();
 await expect.poll(()=>page.locator('#map .leaflet-interactive').count(),{timeout:20000}).toBeGreaterThan(0);
}
function expectMigratedPreferences(preferences,layer='participation'){
 expect(preferences.filters.mapLayer).toBe(layer);
 for(const key of RETIRED_KEYS)expect(preferences.filters).not.toHaveProperty(key);
 expect(preferences.filters.commune).toBe(COMMUNE);
 expect(preferences.filters.query).toBe('Cubzac');
 expect(preferences.filters.analysisCommuneCodes).toEqual(['33366']);
 expect(preferences.mapSelection).toEqual({kind:'commune',value:COMMUNE});
 expect(preferences.mapMode).toBe('explore');
}
async function expectDescriptiveMap(page,layer='participation'){
 await expect(page.locator('#map-layer')).toHaveValue(layer);
 await expect(page.locator('#map-layer option[value=priority]')).toHaveCount(0);
 await expect(page.locator('.priority-controls,#priority-socio,#priority-electoral-weight,#priority-socio-weight')).toHaveCount(0);
 await expect(page.locator('#filter-commune')).toHaveValue(COMMUNE);
 await expect(page.locator('#filter-query')).toHaveValue('Cubzac');
 await expect(page.locator('#map-scope')).toHaveValue('commune');
 await expect(page.locator('#map-scope-value')).toHaveValue(COMMUNE);
 await expect(page.locator('.map-selection-summary')).toContainText(COMMUNE);
 await expect(page.locator('#map .map-legend')).toContainText(layer==='revenuMedian'?'Revenu médian':'Participation électorale');
 if(layer==='revenuMedian'){
  await expect(page.locator('#map .map-legend')).toContainText('€');
  await expect(page.locator('#map .map-legend')).toContainText('Insee');
 }
 const preferences=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),PREFS_KEY);
 expectMigratedPreferences(preferences,layer);
}
async function exportBackup(page){
 const [download]=await Promise.all([
  page.waitForEvent('download'),
  page.locator('button[data-action=backup]:visible').first().click(),
 ]);
 const backup=JSON.parse(await readFile(await download.path(),'utf8'));
 expect(backup.format).toBe('democraction-demo-backup-v1');
 return backup;
}
async function captureMap(page,testInfo,label){
 mkdirSync('test-results/captures',{recursive:true});
 const body=await page.screenshot({path:`test-results/captures/${label}-${testInfo.project.name}.png`,fullPage:true});
 await testInfo.attach(label,{body,contentType:'image/png'});
}
function legacyBackup(){
 const application=emptyState(),created='2026-11-16T10:00:00.000Z';
 application.campaigns[0]={...application.campaigns[0],nom:'Campagne de recette restaurée',description:'Sauvegarde exclusivement fictive.'};
 application.missions=[{id:'mission-logistique-restauree',campaignId:'demo',title:'Préparer le matériel de recette',type:'Distribution',commune:COMMUNE,status:'En cours',notes:'Données de recette uniquement.',created}];
 application.results=[{id:'resultat-synthetique-restaure',commune:COMMUNE,scrutin:'MUNI',inscrits:100,votants:60,exprimes:58,source:'Source synthétique de recette',annee:2026,tour:'1',codeInsee:'33366'}];
 application.team=[{id:'groupe-logistique-restaure',campaignId:'demo',name:'Équipe logistique fictive',commune:COMMUNE,volunteer:'Identifiant de recette'}];
 application.archives=[{id:'archive-logistique-restauree',campaignId:'demo',title:'Mémoire de recette',category:'Logistique',content:'Matériel à vérifier avant la prochaine action.',created}];
 application.drafts=[{id:'brouillon-logistique-restaure',campaignId:'demo',channel:'Note interne',subject:'Préparation du matériel',content:'Réserver le matériel de recette.',created}];
 application.lastSaved=created;
 const sectors=[{id:'secteur-logistique-restaure',name:'Secteur fictif restauré',commune:COMMUNE,geometry:{type:'Polygon',coordinates:[[[-0.49,45.02],[-0.47,45.02],[-0.47,45.04],[-0.49,45.04],[-0.49,45.02]]]}}];
 return {format:'democraction-demo-backup-v1',application,sectors,preferences:legacyPreferences()};
}
function expectApplicationPreserved(actual,expected){
 for(const key of ['version','campaigns','current','missions','results','team','archives','drafts'])expect(actual[key]).toEqual(expected[key]);
 expect(Number.isFinite(new Date(actual.lastSaved).getTime())).toBe(true);
}

test('ancienne préférence de priorité migrée vers une carte descriptive et action depuis la commune',async({page},testInfo)=>{
 test.setTimeout(60000);
 await page.addInitScript(({key,preferences})=>{
  if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(preferences));
 },{key:PREFS_KEY,preferences:legacyPreferences()});
 await page.goto('/');await openMap(page);await expectDescriptiveMap(page);
 const migrated=await exportBackup(page);
 expectMigratedPreferences(migrated.preferences);
 await page.locator('#map-layer').selectOption('revenuMedian');
 await expectDescriptiveMap(page,'revenuMedian');
 await page.reload();await openMap(page);await expectDescriptiveMap(page,'revenuMedian');
 await captureMap(page,testInfo,'carte-descriptive-preferences-migrees');

 await page.locator('[data-action=new-mission-from-map]').last().click();
 await expect(page.locator('#mission-commune')).toHaveValue(COMMUNE);
 await page.locator('#mission-form [name=title]').fill('Action logistique après migration');
 await page.locator('#mission-form button[type=submit]').click();
 await expect(page.locator('#mission-form')).toHaveCount(0);
 const mission=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).missions.find(item=>item.title==='Action logistique après migration'),APP_KEY);
 expect(mission?.commune).toBe(COMMUNE);
 expect(mission?.zoneKind).toBe('commune');
 expect(mission?.zoneCommunes).toEqual([COMMUNE]);
 expect(mission?.zoneGeometry?.type).toMatch(/Polygon/);
 const exported=await exportBackup(page);
 expectMigratedPreferences(exported.preferences,'revenuMedian');
 expect(exported.application.missions.find(item=>item.id===mission.id)).toEqual(mission);
 await page.reload();
 await page.locator('.sidebar [data-nav=actions]:visible, .mobile-nav [data-nav=actions]:visible').first().click();
 await expect(page.locator('.mission-line').filter({hasText:'Action logistique après migration'})).toBeVisible();
 await captureMap(page,testInfo,'carte-descriptive-action-logistique-conservee');
});

test('ancienne sauvegarde JSON restaurée sans couche de priorité ni perte de données',async({page},testInfo)=>{
 test.setTimeout(60000);
 const legacy=legacyBackup();
 await page.goto('/');
 await page.locator('button[data-nav=imports]:visible').first().click();
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('#restore-backup').setInputFiles({name:'ancienne-sauvegarde-synthetique.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacy))});
 await expect(page.locator('.notice[role=status]')).toContainText('Sauvegarde et secteurs restaurés.');
 const restored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),APP_KEY);
 expectApplicationPreserved(restored,legacy.application);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('democraction-demo-sectors')))).toEqual(legacy.sectors);
 await openMap(page);await expectDescriptiveMap(page);
 await expect(page.locator('#campaign-select')).toHaveValue(legacy.application.current);
 await expect(page.locator('[data-sector-select=secteur-logistique-restaure]')).toContainText('Secteur fictif restauré');
 const exported=await exportBackup(page);
 expectMigratedPreferences(exported.preferences);
 expectApplicationPreserved(exported.application,legacy.application);
 expect(exported.sectors).toEqual(legacy.sectors);
 await page.reload();await openMap(page);await expectDescriptiveMap(page);
 expectApplicationPreserved(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),APP_KEY),legacy.application);
 await expect(page.locator('[data-sector-select=secteur-logistique-restaure]')).toContainText('Secteur fictif restauré');
 await captureMap(page,testInfo,'carte-descriptive-sauvegarde-restauree');
 await page.locator('.sidebar [data-nav=actions]:visible, .mobile-nav [data-nav=actions]:visible').first().click();
 await expect(page.locator('.mission-line').filter({hasText:'Préparer le matériel de recette'})).toBeVisible();
});
