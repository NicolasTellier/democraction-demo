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
