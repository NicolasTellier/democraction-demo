import { test, expect } from '@playwright/test';

test('les anciennes coordonnées locales sont retirées au chargement, sur ordinateur et mobile', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('democraction-demo-contacts', JSON.stringify([{
      id: 'old-contact', firstName: 'Alice', lastName: 'Exemple', address: '1 rue privée',
      phone: '0612345678', email: 'alice@real.invalid', note: 'rappel', consent: true
    }]));
    localStorage.setItem('democraction-demo-events', JSON.stringify([{
      id: 'old-event', title: 'Atelier fictif', commune: 'Bourg',
      date: '2026-12-20T15:00', capacity: 2, description: 'Simulation',
      registrations: [{ name: 'Alice Exemple', email: 'alice@real.invalid', created: '2026-11-16T10:00:00.000Z' }]
    }]));
  });
  await page.reload();
  const saved = await page.evaluate(() => ({
    contacts: localStorage.getItem('democraction-demo-contacts'),
    events: localStorage.getItem('democraction-demo-events'),
  }));
  expect(saved.contacts).toBe('[]');
  expect(saved.events).not.toContain('Alice');
  expect(saved.events).not.toContain('alice@real.invalid');
  expect(JSON.parse(saved.events)[0].registrations).toEqual([{ created: '2026-11-16T10:00:00.000Z' }]);
  await page.reload();
  expect(await page.evaluate(() => localStorage.getItem('democraction-demo-contacts'))).toBe('[]');
});

test('un contact et une inscription fictifs ne collectent pas de coordonnées', async ({ page }, testInfo) => {
  test.skip(['iphone', 'android'].includes(testInfo.project.name), 'Navigation de la fiche contact limitée au prototype ordinateur');
  await page.goto('/');
  await page.getByRole('button', { name: 'Contacts fictifs' }).click();
  await expect(page.locator('#contact-form input')).toHaveCount(0);
  await page.locator('#contact-form [name=context]').selectOption('Marché');
  await page.locator('#contact-form button[type=submit]').click();
  await expect(page.getByText('Contact fictif 1')).toBeVisible();
  const contacts = await page.evaluate(() => JSON.parse(localStorage.getItem('democraction-demo-contacts')));
  expect(contacts).toHaveLength(1);
  expect(Object.keys(contacts[0]).sort()).toEqual(['context', 'id', 'number', 'synthetic', 'tags', 'updatedAt']);
  await page.getByRole('button', { name: 'Événements publics' }).click();
  await page.locator('#event-form [name=title]').fill('Atelier fictif');
  await page.locator('#event-form [name=commune]').fill('Bourg');
  await page.locator('#event-form [name=date]').fill('2026-12-20T15:00');
  await page.locator('#event-form [name=capacity]').fill('2');
  await page.locator('#event-form [name=description]').fill('Simulation');
  await page.locator('#event-form button[type=submit]').click();
  await expect(page.locator('.event-register-form input')).toHaveCount(0);
  await page.locator('.event-register-form button[type=submit]').click();
  const events = await page.evaluate(() => JSON.parse(localStorage.getItem('democraction-demo-events')));
  expect(Object.keys(events[0].registrations[0])).toEqual(['created']);
  await page.reload();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('democraction-demo-contacts')).length)).toBe(1);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('democraction-demo-events'))[0].registrations.length)).toBe(1);
});
