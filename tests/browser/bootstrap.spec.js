import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('un chargement électoral retardé ne remplace pas un formulaire en cours de saisie', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Le formulaire des contacts est réservé à la navigation desktop');
  let releaseData;
  const gate = new Promise(resolve => { releaseData = resolve; });
  await page.route('**/data/elections-2008-2026.json.gz*', async route => {
    await gate;
    await route.continue();
  });
  const auditResponse = page.waitForResponse(/\/data\/voies-ecarts\.json/);
  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await auditResponse;
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(page.locator('.boot')).toBeVisible();
    await expect(page.locator('button[data-nav="carte"]')).toHaveCount(0);
  } finally {
    releaseData();
  }
  await page.getByRole('button', { name: 'Contacts consentants' }).click();
  await page.locator('#contact-form [name=firstName]').fill('Démo');
  await page.locator('#contact-form [name=lastName]').fill('Fictif');
  await page.locator('#contact-form [name=consent]').check();
  await page.locator('#contact-form button[type=submit]').click();
  await expect(page.getByText('Démo Fictif')).toBeVisible();
});
