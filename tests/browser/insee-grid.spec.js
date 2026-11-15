import {test, expect} from '@playwright/test';

test.use({serviceWorkers: 'block'});

test('carroyage officiel par commune, 1 km et 200 m sur ordinateur et mobile', async ({page}, info) => {
  test.skip(!['desktop', 'iphone'].includes(info.project.name));
  await page.goto('/');
  if (info.project.name === 'iphone') await page.locator('.mobile-nav [data-nav="carte"]').click();
  else await page.locator('button[data-nav="carte"]:visible').first().click();
  await page.locator('#map-scope-value').selectOption('Saint-André-de-Cubzac');
  await page.locator('#insee-grid-resolution').selectOption('1000');
  await expect(page.locator('#insee-grid-status')).toContainText(/carreaux (affichés|disponibles)/);
  if (/zoomez/.test(await page.locator('#insee-grid-status').innerText())) {
    for (let i = 0; i < 4; i++) await page.locator('#map .leaflet-control-zoom-in').click();
  }
  await expect(page.locator('#map .insee-grid-cell').first()).toBeVisible();
  await expect(page.locator('#insee-grid-status')).toContainText('Insee, Filosofi 2021');
  await page.locator('#insee-grid-resolution').selectOption('200');
  await expect(page.locator('#insee-grid-status')).toContainText(/carreaux (affichés|disponibles)/);
  if (/zoomez/.test(await page.locator('#insee-grid-status').innerText())) {
    for (let i = 0; i < 4; i++) await page.locator('#map .leaflet-control-zoom-in').click();
  }
  await expect(page.locator('#map .insee-grid-cell').first()).toBeVisible();
  await expect(page.locator('#insee-grid-status')).toContainText('valeur imputée');
  await page.reload();
  if (info.project.name === 'iphone') await page.locator('.mobile-nav [data-nav="carte"]').click();
  else await page.locator('button[data-nav="carte"]:visible').first().click();
  await expect(page.locator('#insee-grid-resolution')).toHaveValue('200');
});
