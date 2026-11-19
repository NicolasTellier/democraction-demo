import {test,expect} from '@playwright/test';
import {gzipSync} from 'node:zlib';
import {mkdir} from 'node:fs/promises';
test.use({serviceWorkers:'block'});
test('carte d’écart : signes, zéro, absence, sélection et filtres sur ordinateur/mobile émulé',async({page},testInfo)=>{
 test.skip(!['desktop','iphone'].includes(testInfo.project.name));
 test.setTimeout(60000);
 const base={id:'2020_muni_t1',type:'muni',tour:'t1',annee:2020,codeInsee:'33001',commune:'Abzac',inscrits:100,votants:50,libelle:'Municipales',candidats:[]};
 const rows=[
 base,{...base,id:'2026_muni_t1',annee:2026,votants:80},
 {...base,codeInsee:'33366',commune:'Saint-André-de-Cubzac'},{...base,id:'2026_muni_t1',annee:2026,codeInsee:'33366',commune:'Saint-André-de-Cubzac',votants:20},
 {...base,codeInsee:'33067',commune:'Bourg'},{...base,id:'2026_muni_t1',annee:2026,codeInsee:'33067',commune:'Bourg'},
 {...base,codeInsee:'33114',commune:'Cavignac'},
 {...base,id:'2022_pres_t1',type:'pres',annee:2022,votants:70}
 ];
 await page.route('**/data/elections-2008-2026.json.gz*',route=>route.fulfill({status:200,contentType:'application/octet-stream',body:gzipSync(JSON.stringify({meta:{source:'Source fictive écart',miseAJour:'2026-11-19'},elections:rows.map(row=>({...row,participation:row.votants*100/row.inscrits}))}))}));
 await page.goto('/');
 await page.locator('button[data-nav=carte]:visible').first().click();
 await page.locator('#map-layer').selectOption('participation-difference');
 await expect(page.locator('#difference-a')).toHaveValue('2020_muni_t1');
 await expect(page.locator('#difference-b')).toHaveValue('2026_muni_t1');
 await expect(page.locator('#difference-b option[value="2022_pres_t1"]')).toHaveCount(0);
 const polygon=code=>page.locator('#map [data-commune-code="'+code+'"]');
 const check=async(code,value,color)=>{
  await expect(polygon(code)).toHaveCount(1);
  await expect(polygon(code)).toHaveAttribute('data-map-value',String(value));
  await expect(polygon(code)).toHaveAttribute('fill',color);
 };
 await check('33001',30,'#2166ac');await check('33366',-30,'#b35806');
 await check('33067',0,'#f7f7f7');await check('33114','missing','#c8d0d7');
 const legend=page.locator('#map .map-legend');
 await expect(legend).toContainText('B − A');await expect(legend).toContainText('centrées sur zéro');
 await expect(legend).toContainText('points');await expect(legend).toContainText('Indisponible');
 await expect(legend).toContainText('Source fictive écart');await expect(legend).toContainText('2026-11-19');
 await expect(page.locator('[data-difference-coverage]')).toContainText('3/87 communes');
 await expect(page.locator('#insee-grid-resolution')).toBeDisabled();
 await page.locator('#difference-a').selectOption('2026_muni_t1');
 await check('33001',-30,'#b35806');await check('33366',30,'#2166ac');await check('33067',0,'#f7f7f7');
 await page.locator('#filter-query').fill('Abzac');
 await expect(page.locator('[data-difference-coverage]')).toContainText('1/2 communes');
 await check('33001',-30,'#b35806');await expect(polygon('33366')).toHaveCount(0);
 await page.locator('#map-scope-value').selectOption('Abzac');
 await check('33001',-30,'#b35806');
 await expect(polygon('33001')).toHaveAttribute('stroke-width','3');
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.locator('#map').evaluate(element=>element.scrollIntoView({block:'center',behavior:'instant'}));
 await mkdir('test-results/captures',{recursive:true});
 await page.screenshot({path:'test-results/captures/difference-map-'+testInfo.project.name+'.png'});
 await page.reload();
 await page.locator('button[data-nav=carte]:visible').first().click();
 await expect(page.locator('#map-layer')).toHaveValue('participation-difference');
 await check('33001',-30,'#b35806');
 await page.locator('[data-map-mode="compare"]').click();
 await expect(page.locator('.map-compare-table strong')).toContainText('Écarts A − B');
 await expect(page.locator('.map-compare-table')).toContainText('+30.0');
 await expect(page.locator('#map-left .map-legend')).toContainText('Participation électorale');
 await expect(page.locator('#map-left .map-legend')).not.toContainText('centrées sur zéro');
});
