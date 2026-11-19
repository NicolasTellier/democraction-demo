import {gzipSync} from 'node:zlib';
import { test, expect } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';

test('la courbe historique est sourcée et ne mélange pas les tours', async ({ page }, testInfo) => {
  test.skip(['iphone', 'android'].includes(testInfo.project.name), 'Navigation des résultats réservée à la version desktop de la démonstration');
  await page.goto('/');
  await page.getByRole('button', { name: 'Résultats électoraux' }).click();
  await page.locator('#election-type').selectOption('muni');
  await page.locator('#election-tour').selectOption('t1');
  await expect(page.locator('.election-timeline')).toBeVisible();
  await expect(page.locator('.election-timeline')).toHaveAttribute('aria-label', /Municipales · 1er tour/);
  await expect(page.getByText(/Source : data.gouv.fr \/ ministère de l’Intérieur/).first()).toBeVisible();
  await expect(page.locator('.timeline-scroll + .tablewrap tbody tr').first()).toContainText('2008');
  await expect(page.locator('.timeline-scroll + .tablewrap tbody tr').last()).toContainText('2026');
});

test('comparaison communale sourcée sur ordinateur et smartphone, conservée après fermeture', async ({ page }, testInfo) => {
  test.skip(!['desktop', 'iphone'].includes(testInfo.project.name));
  await page.goto('/');
  if (testInfo.project.name === 'iphone') await page.locator('.mobile-nav [data-nav="analyse"]').click();
  else await page.getByRole('button', { name: 'Résultats électoraux' }).click();
  await page.locator('#election-type').selectOption('muni');
  await page.locator('#election-tour').selectOption('t1');
  await page.locator('#analysis-ballot-a').selectOption('2020_muni_t1');
  await page.locator('#analysis-ballot-b').selectOption('2026_muni_t1');
  await page.locator('#analysis-commune-search').fill('Abzac');
  await page.locator('input[name="analysis-commune"][value="33001"]').check();
  await page.locator('#analysis-commune-search').fill('Saint-André-de-Cubzac');
  await page.locator('input[name="analysis-commune"][value="33366"]').check();
  const table = page.getByRole('table', { name: 'Effectifs et taux exacts par commune' });
  await expect(table.locator('tbody tr')).toHaveCount(2);
  await expect(table.getByRole('row', { name: /Abzac/ })).toContainText('1 515');
  await expect(table.getByRole('row', { name: /Saint-André-de-Cubzac/ })).toContainText('8 710');
  await expect(page.getByText(/Source : data.gouv.fr \/ ministère de l’Intérieur/).last()).toBeVisible();
  const [exported] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exporter cette comparaison (CSV)' }).click()]);
  const csv = await readFile(await exported.path(), 'utf8');
  expect(exported.suggestedFilename()).toMatch(/^comparaison-communale-\d{4}-\d{2}-\d{2}\.csv$/);
  expect(csv).toContain('code_insee;scrutin_a;inscrits_a');
  expect(csv).toContain('33001;Municipales 2020 — tour 1;1515;713;');
  expect(csv).toContain('data.gouv.fr / ministère de l’Intérieur');
  await page.reload();
  if (testInfo.project.name === 'iphone') await page.locator('.mobile-nav [data-nav="analyse"]').click();
  else await page.getByRole('button', { name: 'Résultats électoraux' }).click();
  await expect(page.locator('input[name="analysis-commune"]:checked')).toHaveCount(2);
  await expect(page.locator('#analysis-ballot-a')).toHaveValue('2020_muni_t1');
  await expect(page.locator('#analysis-ballot-b')).toHaveValue('2026_muni_t1');
});

test('une comparaison descriptive enregistrée se rouvre et se supprime sur ordinateur et smartphone', async ({ page }, testInfo) => {
  test.skip(!['desktop', 'iphone'].includes(testInfo.project.name));
  await page.goto('/');
  if (testInfo.project.name === 'iphone') await page.locator('.mobile-nav [data-nav="analyse"]').click();
  else await page.getByRole('button', { name: 'Résultats électoraux' }).click();
  await page.locator('#election-type').selectOption('muni');
  await page.locator('#election-tour').selectOption('t1');
  await page.locator('#analysis-ballot-a').selectOption('2020_muni_t1');
  await page.locator('#analysis-ballot-b').selectOption('2026_muni_t1');
  await page.locator('input[name="analysis-commune"][value="33001"]').check();
  await page.locator('input[name="analysis-commune"][value="33366"]').check();
  await page.getByRole('button', { name: 'Enregistrer cette comparaison' }).click();
  await expect(page.locator('.comparison-saved-list li')).toHaveCount(1);
  await expect(page.locator('.comparison-saved-list')).toContainText('Source : data.gouv.fr / ministère de l’Intérieur');
  await page.locator('input[name="analysis-commune"][value="33001"]').uncheck();
  await page.reload();
  if (testInfo.project.name === 'iphone') await page.locator('.mobile-nav [data-nav="analyse"]').click();
  else await page.getByRole('button', { name: 'Résultats électoraux' }).click();
  await expect(page.locator('input[name="analysis-commune"]:checked')).toHaveCount(1);
  await page.locator('.comparison-saved-list').getByRole('button', { name: 'Ouvrir' }).click();
  await expect(page.locator('input[name="analysis-commune"]:checked')).toHaveCount(2);
  await expect(page.locator('#analysis-ballot-a')).toHaveValue('2020_muni_t1');
  await expect(page.locator('#analysis-ballot-b')).toHaveValue('2026_muni_t1');
  await page.screenshot({ path: `test-results/captures/comparison-saved-${testInfo.project.name}.png`, fullPage: true });
  await page.locator('.comparison-saved-list').getByRole('button', { name: 'Supprimer' }).click();
  await expect(page.locator('.comparison-saved-list li')).toHaveCount(0);
  await page.reload();
  if (testInfo.project.name === 'iphone') await page.locator('.mobile-nav [data-nav="analyse"]').click();
  else await page.getByRole('button', { name: 'Résultats électoraux' }).click();
  await expect(page.getByText('Aucune comparaison enregistrée sur cet appareil.')).toBeVisible();
});

test('historique : couverture sans effectifs absents et zéro explicite sur ordinateur et mobile émulé',async({page},testInfo)=>{
 test.skip(!['desktop','iphone'].includes(testInfo.project.name));
 const row={type:'muni',tour:'t1',codeInsee:'33001',commune:'Abzac',inscrits:100,votants:0,libelle:'Municipales',candidats:[]};
 const elections={meta:{source:'Source synthétique DATA-02d',miseAJour:'2026-11-19'},elections:[
  {...row,id:'2020_muni_t1',annee:2020,votants:50},
  {...row,id:'2026_muni_t1',annee:2026},
  {...row,id:'2026_muni_t1',annee:2026,codeInsee:'33366',commune:'Saint-André-de-Cubzac',inscrits:900,votants:null},
  {...row,id:'2022_muni_t1',annee:2022,votants:''}
 ]};
 await page.route('**/data/elections-2008-2026.json.gz*',route=>route.fulfill({status:200,contentType:'application/octet-stream',body:gzipSync(JSON.stringify(elections))}));
 await page.goto('/');
 await page.locator('button[data-nav="analyse"]:visible').first().click();
 await page.locator('#election-type').selectOption('muni');
 await page.locator('#election-tour').selectOption('t1');
 const table=page.getByRole('table',{name:'Valeurs exactes du graphique historique'});
 await expect(table.locator('tbody tr')).toHaveCount(2);
 const current=table.locator('tbody tr').filter({has:page.getByRole('rowheader',{name:'2026',exact:true})});
 await expect(current.locator('td').nth(0)).toHaveText('1');
 await expect(current.locator('td').nth(1)).toHaveText('100');
 await expect(current.locator('td').nth(2)).toHaveText('0,0 %');
 await expect(current.locator('td').nth(3)).toHaveText('100,0 %');
 await expect(table).not.toContainText('2022');
 await expect(page.getByText(/Source : Source synthétique DATA-02d/).first()).toBeVisible();
 await page.getByText('Voir l’historique en barres',{exact:true}).click();
 const bars=page.locator('.history-bars');
 await expect(bars).toBeVisible();
 await expect(bars.locator('.history-bars-year')).toHaveCount(2);
 await expect(bars.locator('[data-year="2022"]')).toHaveCount(0);
 await expect(bars.locator('[data-year="2026"]')).toContainText('1 commune(s) · 100 inscrits');
 await expect(bars.locator('[data-year="2026"] .history-bar-participation')).toHaveAttribute('style','width:0%');
 await expect(bars.locator('[data-year="2026"] .history-bar-abstention')).toHaveAttribute('style','width:100%');
 await expect(bars.locator('[data-year="2020"] .history-bar-participation')).toHaveAttribute('style','width:50%');
 await bars.scrollIntoViewIfNeeded();
 await mkdir('test-results/captures',{recursive:true});
 await page.locator('.history-bars-details').screenshot({path:'test-results/captures/history-bars-'+testInfo.project.name+'.png'});

});
