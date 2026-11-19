import {test,expect} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
test.use({serviceWorkers:'block'});
const reference=JSON.parse(await readFile(new URL('../fixtures/participation-real.json',import.meta.url),'utf8'));

test('histogramme réel : six scrutins/périmètres, fréquences, couverture et filtres',async({page},testInfo)=>{
 test.skip(!['desktop','iphone'].includes(testInfo.project.name));
 await page.goto('/');
 await page.locator('button[data-nav="analyse"]:visible').first().click();
 const figure=page.locator('.participation-distribution');
 for(const scenario of reference.scenarios){
  await page.locator('#filter-commune').selectOption(scenario.scope);
  await page.locator('#election-type').selectOption(scenario.type);
  await page.locator('#election-tour').selectOption(scenario.tour);
  await page.locator('#election-year').selectOption(String(scenario.year));
  await page.getByText('Voir l’histogramme des communes',{exact:true}).click();
  await expect(figure.locator('.distribution-bin')).toHaveCount(10);
  await expect(figure).toContainText(scenario.eligible+' commune(s) admissible(s) · 0 ligne(s) exclue(s) · 0 commune(s) en doublon');
  await expect(figure.locator('figcaption')).toContainText(String(scenario.year));
  await expect(figure).toContainText(reference.source);
  await expect(figure).toContainText('mise à jour '+reference.updated);
  await expect(figure).toContainText('sans pondération par population');
  let sum=0;
  for(let index=0;index<10;index++){
   const row=figure.locator('.distribution-bin[data-min="'+index*10+'"]');
   await expect(row).toHaveAttribute('data-count',String(scenario.bins[index]));
   await expect(row.locator('td').nth(0)).toHaveText(String(scenario.bins[index]));
   const width=Number((await row.locator('i').getAttribute('style')).replace('width:','').replace('%',''));
   expect(width).toBeCloseTo(scenario.bins[index]*100/scenario.eligible,10);
   sum+=Number(await row.getAttribute('data-count'));
  }
  expect(sum).toBe(scenario.eligible);
 }
 await page.emulateMedia({reducedMotion:'reduce'});
 await figure.evaluate(element=>element.scrollIntoView({block:'center',behavior:'instant'}));
 await expect.poll(()=>figure.evaluate(element=>{
  const rect=element.getBoundingClientRect(),table=element.querySelector('table').getBoundingClientRect();
  const nav=document.querySelector('.mobile-nav');
  const bottom=nav&&getComputedStyle(nav).display!=='none'?nav.getBoundingClientRect().top:innerHeight;
  return rect.top>=0&&rect.bottom<=bottom&&table.right<=rect.right+0.5;
 })).toBe(true);
 await expect(figure.getByRole('columnheader',{name:'Fréquence',exact:true})).toBeInViewport();
 await mkdir('test-results/captures',{recursive:true});
 await page.screenshot({path:'test-results/captures/distribution-real-'+testInfo.project.name+'.png'});
 await page.locator('#filter-commune').selectOption('');
 await page.locator('#election-type').selectOption('euro');
 await page.locator('#election-year').selectOption('2024');
 await page.locator('#election-tour').selectOption('t2');
 await expect(page.getByText('Aucune commune admissible pour cet histogramme.')).toBeVisible();
 await expect(figure).toHaveCount(0);
});
