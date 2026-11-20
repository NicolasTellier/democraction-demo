import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {emptyState} from '../../app/core.js';
import {openManualMission} from '../helpers/mission-simulation.js';

test.use({serviceWorkers:'block'});

test('carte analytique sans création et action manuelle sans héritage géographique',async({page},testInfo)=>{
 test.setTimeout(60000);
 await page.addInitScript(()=>{
  if(!localStorage.getItem('democraction-demo-preferences'))localStorage.setItem('democraction-demo-preferences',JSON.stringify({
   filters:{commune:'Saint-André-de-Cubzac',mapLayer:'revenuMedian',socioIndicator:'tauxChomage',socioMin:'5',gridResolution:'1000'},
   mapSelection:{kind:'commune',value:'Saint-André-de-Cubzac'},mapMode:'organize'}));
 });
 await page.goto('/');
 await page.locator('button[data-nav=carte]:visible').first().click();
 await expect(page.locator('[data-map-mode=organize]')).toHaveCount(0);
 await expect(page.locator('[data-map-mode=explore]')).toHaveClass(/btn-primary/);
 for(const mode of ['explore','compare','draw']){
  await page.locator(`[data-map-mode=${mode}]`).click();
  await expect(page.locator('[data-action=new-mission-from-map]')).toHaveCount(0);
  await expect(page.locator('#mission-form')).toHaveCount(0);
 }
 await page.locator('[data-map-mode=explore]').click();
 await page.locator('#map-layer').selectOption('participation-difference');
 await expect(page.locator('.difference-controls')).toBeVisible();
 await expect(page.locator('[data-action=new-mission-from-map]')).toHaveCount(0);
 // A control from a stale page must also be rejected by the dispatcher.
 await page.evaluate(()=>{const b=document.createElement('button');b.dataset.action='new-mission-from-map';b.textContent='Ancienne commande de recette';document.getElementById('root').append(b);b.click()});
 await expect(page.locator('.notice')).toContainText('Création depuis la carte désactivée');
 await expect(page.locator('#mission-form')).toHaveCount(0);
 await openManualMission(page,'Action manuelle indépendante','Bourg');
 await expect(page.locator('#mission-form [name=rues] option:checked')).toHaveCount(0);
 mkdirSync('test-results/captures',{recursive:true});
 await page.screenshot({path:`test-results/captures/separation-action-vide-${testInfo.project.name}.png`,fullPage:true});
 await page.locator('#mission-form button[type=submit]').click();
 const mission=await page.evaluate(()=>JSON.parse(localStorage.getItem('democraction-v1-local')).missions.find(x=>x.title==='Action manuelle indépendante'));
 expect(mission.commune).toBe('Bourg');expect(mission.zoneCommunes).toEqual(['Bourg']);
 expect(mission.zoneId).toBe('');expect(mission.zoneKind).toBe('');expect(mission.zoneGeometry).toBeNull();
 expect(mission.roadIds).toEqual([]);expect(mission.rues).toEqual([]);expect(mission.secteur).toBe('');
 for(const key of ['mapLayer','socioIndicator','socioMin','gridResolution','analysisCommuneCodes','mapSelection'])expect(mission).not.toHaveProperty(key);
 await page.reload();await page.locator('.sidebar [data-nav=actions]:visible, .mobile-nav [data-nav=actions]:visible').first().click();
 const saved=await page.evaluate(id=>JSON.parse(localStorage.getItem('democraction-v1-local')).missions.find(x=>x.id===id),mission.id);
 expect(saved).toEqual(mission);
 // Filters can hide a manually chosen commune; reset the list to verify it.
 await page.locator('#filter-commune').selectOption('');
 await expect(page.getByText('Action manuelle indépendante',{exact:true})).toBeVisible();
});

test('lecture et terrain ne créent pas une action par commande périmée',async({page})=>{
 const state=emptyState();let writes=0;
 await page.route('**/api/session',route=>route.fulfill({json:{authenticated:true,role:'lecture',username:'lecteur-fictif',csrf:'fictif'}}));
 await page.route('**/api/state',route=>{
  if(route.request().method()!=='GET')writes++;
  return route.fulfill({json:{state,revision:0}});
 });
 await page.goto('/');await expect(page.locator('.work-mode')).toContainText(/connecté/i);
 for(const role of ['lecture','terrain']){
  await page.unroute('**/api/session');
  await page.route('**/api/session',route=>route.fulfill({json:{authenticated:true,role,username:'compte-fictif',csrf:'fictif'}}));
  await page.reload();await expect(page.locator('.work-mode')).toContainText(/connecté/i);
  await page.locator('.sidebar [data-nav=actions]:visible, .mobile-nav [data-nav=actions]:visible').first().click();
  await expect(page.locator('[data-action=new-mission]')).toHaveCount(0);
  for(const action of ['new-mission','new-mission-from-map']){
   await page.evaluate(action=>{const b=document.createElement('button');b.dataset.action=action;document.getElementById('root').append(b);b.click()},action);
   await expect(page.locator('#mission-form')).toHaveCount(0);
  }
 }
 expect(writes).toBe(0);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('democraction-v1-local')).missions)).toEqual([]);
});
