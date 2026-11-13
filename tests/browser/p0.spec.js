import {test,expect} from '@playwright/test';

test('polygones, échelle et sélection conservés après rechargement',async({page})=>{
 await page.goto('/');
 await page.locator('button[data-nav=carte]:visible').first().click();
 await expect.poll(()=>page.locator('#map .leaflet-interactive').count(),{timeout:20000}).toBeGreaterThanOrEqual(87);
 await expect(page.locator('#map .map-legend')).toContainText('Participation électorale');
 await page.locator('#map-scope-value').selectOption('Saint-André-de-Cubzac');
 await expect(page.locator('.map-selection-summary')).toContainText('Saint-André-de-Cubzac');
 await expect.poll(()=>page.locator('#map .leaflet-interactive').count(),{timeout:20000}).toBeGreaterThanOrEqual(87);
 await page.locator('#map-layer').selectOption('revenuMedian');
 await expect(page.locator('#map .map-legend')).toContainText('€');
 await expect(page.locator('#map .map-legend')).toContainText('Insee');
 await page.reload();
 await page.locator('button[data-nav=carte]:visible').first().click();
 await expect.poll(()=>page.locator('#map .leaflet-interactive').count(),{timeout:20000}).toBeGreaterThanOrEqual(87);
});

test('les formulaires de démonstration enregistrent réellement leurs données locales',async({page},testInfo)=>{
 test.skip(['iphone','android'].includes(testInfo.project.name),'Navigation contacts réservée à la version desktop du prototype');
 await page.goto('/');
 await page.getByRole('button',{name:'Contacts consentants'}).click();
 await page.locator('#contact-form [name=firstName]').fill('Démo');
 await page.locator('#contact-form [name=lastName]').fill('Fictif');
 await page.locator('#contact-form [name=consent]').check();
 await page.locator('#contact-form button[type=submit]').click();
 await expect(page.getByText('Démo Fictif')).toBeVisible();
 await page.getByRole('button',{name:'Événements publics'}).click();
 await page.locator('#event-form [name=title]').fill('Atelier fictif');
 await page.locator('#event-form [name=commune]').fill('Bourg');
 await page.locator('#event-form [name=date]').fill('2026-12-20T15:00');
 await page.locator('#event-form [name=capacity]').fill('2');
 await page.locator('#event-form [name=description]').fill('Simulation');
 await page.locator('#event-form button[type=submit]').click();
 await page.locator('.event-register-form [name=name]').fill('Personne fictive');
 await page.locator('.event-register-form [name=email]').fill('test@example.org');
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

test('secteur dessiné, édition et action liée conservés au rechargement',async({page},testInfo)=>{
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
 await page.locator('[data-action=new-mission-from-map]').last().click();
 await page.locator('#mission-form [name=title]').fill('Action sur secteur test');
 await page.locator('#mission-form button[type=submit]').click();
 const mission=await page.evaluate(id=>JSON.parse(localStorage.getItem('democraction-v1-local')).missions.find(m=>m.zoneId===id),sector.id);
 expect(mission.zoneKind).toBe('sector');
 expect(mission.zoneGeometry).toEqual(edited.geometry);
 await page.reload();
 await page.locator('button[data-nav=carte]:visible').first().click();
 await expect(page.locator(`[data-sector-select="${sector.id}"]`)).toContainText('Secteur test modifié');
 await page.locator('button[data-nav=actions]:visible').first().click();
 await expect(page.getByText('Action sur secteur test')).toBeVisible();
});
