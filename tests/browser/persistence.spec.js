import {test,expect} from '@playwright/test';

test('secteur et action fictifs survivent à la fermeture de l’onglet',async({page,context},testInfo)=>{
 test.skip(['iphone','android'].includes(testInfo.project.name),'Le dessin au doigt requiert une recette manuelle mobile');

 const sectorName='Secteur fictif de persistance';
 const actionTitle='Action fictive de persistance';
 await page.goto('/');
 await page.locator('button[data-nav=carte]:visible').first().click();
 await page.locator('#map-scope-value').selectOption({label:'Saint-André-de-Cubzac'});
 await page.locator('button[data-map-mode=draw]').click();
 await expect.poll(()=>page.locator('#map.leaflet-container').count(),{timeout:20000}).toBe(1);
 await page.locator('#sector-name').fill(sectorName);
 await page.locator('[data-map-draw-start]').click();
 for(const point of [{x:170,y:140},{x:215,y:140},{x:210,y:185},{x:165,y:190}])
  await page.locator('#map').click({position:point});
 await expect(page.locator('#map .sector-vertex')).toHaveCount(4);
 await page.locator('[data-map-draw-finish]').click();
 await expect(page.locator('.map-selection-summary')).toContainText(sectorName);
 const sector=await page.evaluate(name=>JSON.parse(localStorage.getItem('democraction-demo-sectors')).find(item=>item.name===name),sectorName);
 expect(sector.geometry.coordinates[0]).toHaveLength(5);

 await page.locator('[data-action=new-mission-from-map]').last().click();
 await page.locator('#mission-form [name=title]').fill(actionTitle);
 await page.locator('#mission-form button[type=submit]').click();
 const action=await page.evaluate(id=>JSON.parse(localStorage.getItem('democraction-v1-local')).missions.find(item=>item.zoneId===id),sector.id);
 expect(action.title).toBe(actionTitle);
 expect(action.zoneKind).toBe('sector');

 await page.close();
 expect(page.isClosed()).toBe(true);
 const reopened=await context.newPage();
 await reopened.goto('/');
 await reopened.locator('button[data-nav=carte]:visible').first().click();
 await expect(reopened.locator(`[data-sector-select="${sector.id}"]`)).toContainText(sectorName);
 await reopened.locator('button[data-nav=actions]:visible').first().click();
 await expect(reopened.getByText(actionTitle)).toBeVisible();
 const saved=await reopened.evaluate(({sectorId,actionId})=>({
  sector:JSON.parse(localStorage.getItem('democraction-demo-sectors')).find(item=>item.id===sectorId),
  action:JSON.parse(localStorage.getItem('democraction-v1-local')).missions.find(item=>item.id===actionId)
 }),{sectorId:sector.id,actionId:action.id});
 expect(saved.sector.geometry).toEqual(sector.geometry);
 expect(saved.action.zoneId).toBe(sector.id);
 expect(saved.action.zoneGeometry).toEqual(sector.geometry);
});
