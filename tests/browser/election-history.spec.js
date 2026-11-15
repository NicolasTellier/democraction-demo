import { test, expect } from '@playwright/test';

test('la courbe historique est sourcée et ne mélange pas les tours', async ({ page }, testInfo) => {
  test.skip(['iphone', 'android'].includes(testInfo.project.name), 'Navigation des résultats réservée à la version desktop de la démonstration');
  await page.goto('/');
  await page.getByRole('button', { name: 'Résultats électoraux' }).click();
  await page.locator('#election-type').selectOption('muni');
  await page.locator('#election-tour').selectOption('t1');
  await expect(page.locator('.election-timeline')).toBeVisible();
  await expect(page.locator('.election-timeline')).toHaveAttribute('aria-label', /Municipales · 1er tour/);
  await expect(page.getByText(/Source : data.gouv.fr \/ ministère de l’Intérieur/)).toBeVisible();
  await expect(page.locator('.timeline-scroll + .tablewrap tbody tr').first()).toContainText('2008');
  await expect(page.locator('.timeline-scroll + .tablewrap tbody tr').last()).toContainText('2026');
});
