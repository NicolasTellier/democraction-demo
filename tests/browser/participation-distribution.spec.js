import {test,expect} from '@playwright/test';
import {gzipSync} from 'node:zlib';
import {mkdir} from 'node:fs/promises';
test.use({serviceWorkers:'block'});
test('histogramme : classes, exclusions, année et périmètre sur ordinateur/mobile émulé',async({page},testInfo)=>{
 test.skip(!['desktop','iphone'].includes(testInfo.project.name));
 const base={id:'2026_muni_t1',annee:2026,type:'muni',tour:'t1',codeInsee:'33001',commune:'Abzac',inscrits:100,votants:0,libelle:'Municipales',candidats:[]};
 const elections={meta:{source:'Source fictive histogramme',miseAJour:'2026-11-19'},elections:[
 base,{...base,codeInsee:'33366',commune:'Saint-André-de-Cubzac',votants:100},
 {...base,codeInsee:'33067',commune:'Bourg',votants:null},
 {...base,codeInsee:'33114',commune:'Cavignac',votants:50},{...base,codeInsee:'33114',commune:'Cavignac',votants:60},
 {...base,id:'2020_muni_t1',annee:2020,votants:50}]};
 await page.route('**/data/elections-2008-2026.json.gz*',route=>route.fulfill({status:200,contentType:'application/octet-stream',body:gzipSync(JSON.stringify(elections))}));
 await page.goto('/');
 await page.locator('button[data-nav="analyse"]:visible').first().click();
 await expect(page.getByText('Sélectionnez un type de scrutin, une année et un tour pour afficher l’histogramme.')).toBeVisible();
 await page.locator('#election-type').selectOption('muni');
 await page.locator('#election-year').selectOption('2026');
 await page.locator('#election-tour').selectOption('t1');
 await page.getByText('Voir l’histogramme des communes',{exact:true}).click();
 const figure=page.locator('.participation-distribution');
 await expect(figure.locator('.distribution-bin')).toHaveCount(10);
 await expect(figure).toContainText('2 commune(s) admissible(s) · 3 ligne(s) exclue(s) · 1 commune(s) en doublon');
 await expect(figure.locator('[data-min="0"]')).toHaveAttribute('data-count','1');
 await expect(figure.locator('[data-min="90"]')).toHaveAttribute('data-count','1');
 await expect(figure.locator('[data-min="0"] i')).toHaveAttribute('style','width:50%');
 await expect(figure.locator('[data-min="50"]')).toHaveAttribute('data-count','0');
 await expect(figure).toContainText('Source fictive histogramme');
 await expect(figure).toContainText('2026-11-19');
 await page.emulateMedia({reducedMotion:'reduce'});
 await figure.evaluate(element=>element.scrollIntoView({block:'center',behavior:'instant'}));
 await expect.poll(()=>figure.evaluate(element=>{
  const rect=element.getBoundingClientRect(),nav=document.querySelector('.mobile-nav');
  const bottom=nav&&getComputedStyle(nav).display!=='none'?nav.getBoundingClientRect().top:innerHeight;
  return rect.top>=0&&rect.bottom<=bottom;
 })).toBe(true);
 await expect(figure.locator('[data-min="90"]')).toBeInViewport();
 await mkdir('test-results/captures',{recursive:true});
 await figure.screenshot({path:'test-results/captures/distribution-'+testInfo.project.name+'.png'});
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.locator('#election-year').selectOption('2020');
 await page.getByText('Voir l’histogramme des communes',{exact:true}).click();
 await expect(figure).toContainText('1 commune(s) admissible(s)');
 await expect(figure.locator('[data-min="50"]')).toHaveAttribute('data-count','1');
 await expect(figure.locator('[data-min="50"] i')).toHaveAttribute('style','width:100%');
 await page.locator('#election-year').selectOption('2026');
 await page.locator('#filter-commune').selectOption('Bourg');
 await expect(page.getByText('Aucune commune admissible pour cet histogramme.')).toBeVisible();
 await expect(page.locator('.participation-distribution')).toHaveCount(0);
});
