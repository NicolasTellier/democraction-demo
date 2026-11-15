import {test,expect} from '@playwright/test';

test.use({serviceWorkers:'block'});

test('abstention communale, scrutin identifié, total pondéré et persistance',async({page})=>{
 await page.goto('/');
 await page.locator('button[data-nav=carte]:visible').first().click();
 await page.locator('#map-layer').selectOption('abstention');
 await expect(page.locator('#map-ballot')).toBeVisible();
 await page.locator('#map-ballot').selectOption('2026_muni_t1');
 await expect(page.locator('#map-ballot option:checked')).toHaveText('Municipales 2026 — tour 1');
 await expect(page.locator('#map .map-legend')).toContainText('Abstention électorale');
 await expect(page.locator('#map .map-legend')).toContainText('Municipales 2026');
 await expect(page.locator('.map-rail')).toContainText('Abstention = (inscrits − votants) / inscrits');
 await expect(page.locator('.map-rail')).toContainText('Sur 87 commune(s) du périmètre');
 await page.locator('#map-scope-value').selectOption('Abzac');
 await expect(page.locator('.map-detail .panel')).toContainText('Abstention · Municipales 2026 — tour 1');
 await expect(page.locator('.map-detail .panel')).toContainText('41,3 %');
 await page.reload();
 await page.locator('button[data-nav=carte]:visible').first().click();
 await expect(page.locator('#map-layer')).toHaveValue('abstention');
 await expect(page.locator('#map-ballot')).toHaveValue('2026_muni_t1');
});
