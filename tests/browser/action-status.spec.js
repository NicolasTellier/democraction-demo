import {openManualMission, seedLegacyGeometryMission} from '../helpers/mission-simulation.js';
import {test,expect} from '@playwright/test';

test.use({serviceWorkers:'block'});

test('le statut d’une action change sur la liste et la carte puis persiste',async({page})=>{
 const openActions=()=>page.locator('.sidebar [data-nav=actions]:visible, .mobile-nav [data-nav=actions]:visible').first().click();
 await page.goto('/');
 await page.locator('button[data-nav=carte]:visible').first().click();
 await page.locator('#map-scope-value').selectOption({label:'Saint-André-de-Cubzac'});
 await seedLegacyGeometryMission(page,{title:'Action logistique de recette'});
 const mission=await page.evaluate(()=>JSON.parse(localStorage.getItem('democraction-v1-local')).missions.find(m=>m.title==='Action logistique de recette'));
 expect(mission?.zoneGeometry?.type).toMatch(/Polygon/);

 const action=()=>page.locator('.mission-line').filter({hasText:'Action logistique de recette'});
 await openActions();
 await expect(action().locator('.status-todo')).toHaveText('À faire');
 await action().locator('[data-edit-mission]').click();
 await page.locator('#mission-form [name=status]').selectOption('En cours');
 await page.locator('#mission-form button[type=submit]').click();
 await expect(action().locator('.status-progress')).toHaveText('En cours');
 await page.locator('button[data-nav=carte]:visible').first().click();
 await expect.poll(()=>page.locator('#map .leaflet-interactive[stroke="#ee4b23"][stroke-dasharray="4 4"]').count(),{timeout:20000}).toBeGreaterThan(0);

 await page.reload();
 await openActions();
 await expect(action().locator('.status-progress')).toHaveText('En cours');
 await action().locator('[data-edit-mission]').click();
 await page.locator('#mission-form [name=status]').selectOption('Terminée');
 await page.locator('#mission-form button[type=submit]').click();
 await expect(action().locator('.status-done')).toHaveText('Terminée');
 await page.locator('button[data-nav=carte]:visible').first().click();
 await expect.poll(()=>page.locator('#map .leaflet-interactive[stroke="#2b6e46"][stroke-dasharray="4 4"]').count(),{timeout:20000}).toBeGreaterThan(0);
 const saved=await page.evaluate(id=>JSON.parse(localStorage.getItem('democraction-v1-local')).missions.find(m=>m.id===id),mission.id);
 expect(saved.status).toBe('Terminée');
 expect(saved.zoneGeometry).toEqual(mission.zoneGeometry);
});
