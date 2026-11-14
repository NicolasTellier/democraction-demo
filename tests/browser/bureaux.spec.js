import {test,expect} from '@playwright/test';

test.use({serviceWorkers:'block'});

test('les 23 bureaux sont consultables sans attribuer un faux contour ou un résultat',async({page})=>{
 await page.goto('/');
 await page.locator('button[data-nav=carte]:visible').first().click();
 await page.locator('#map-scope').selectOption('bureau');
 await expect(page.locator('.map-rail')).toContainText('23 bureaux fournis');
 await page.locator('#bureau-commune').selectOption('Bourg');
 await expect(page.locator('#map-scope-value option')).toHaveCount(3);
 await page.locator('#map-scope-value').selectOption('33067-1');
 await expect(page.locator('.map-detail .panel')).toContainText('Bureau 1 · Bourg');
 await expect(page.locator('.map-detail .panel')).toContainText('875');
 await expect(page.locator('.map-detail .panel')).toContainText('nature et millésime à vérifier');
 await expect(page.locator('.map-selection-summary')).toContainText('Contour de bureau absent');
 await expect.poll(()=>page.locator('#map .leaflet-interactive').count(),{timeout:20000}).toBeGreaterThanOrEqual(87);
 await expect.poll(()=>page.locator('#map .leaflet-interactive[stroke="#16163f"]').count(),{timeout:20000}).toBeGreaterThanOrEqual(1);
 await expect(page.locator('#map .leaflet-interactive[stroke="#7a1838"]')).toHaveCount(0);
 await page.locator('[data-action=new-mission-from-map]').last().click();
 await expect(page.locator('.notice')).toContainText('ne possède pas de contour');
 await expect(page.locator('#mission-form')).toHaveCount(0);
 await page.locator('#bureau-commune').selectOption('Coutras');
 await expect(page.locator('#map-scope-value option')).toHaveCount(8);
 await page.locator('#map-scope-value').selectOption('33138-7');
 await expect(page.locator('.map-detail .panel')).toContainText('995');
});
