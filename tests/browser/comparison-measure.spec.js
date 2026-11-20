import {test,expect} from '@playwright/test';
import {gzipSync} from 'node:zlib';
import {readFile,mkdir} from 'node:fs/promises';
const KEY='democraction-demo-comparison-views';
const legacy={version:1,id:'ancienne',ballotA:'2020_muni_t1',ballotB:'2026_muni_t1',type:'muni',tour:'t1',communeCodes:['33001','33366'],savedAt:'2026-11-20T08:00:00Z',source:'Source fictive mesure',sourceDate:'2026-11-20'};
const base={type:'muni',tour:'t1',libelle:'Municipales',candidats:[],inscrits:100};
const dataset={meta:{source:'Source fictive mesure',miseAJour:'2026-11-20'},elections:[
 {...base,id:'2020_muni_t1',annee:2020,codeInsee:'33001',commune:'Abzac',votants:50},
 {...base,id:'2026_muni_t1',annee:2026,codeInsee:'33001',commune:'Abzac',votants:0},
 {...base,id:'2020_muni_t1',annee:2020,codeInsee:'33366',commune:'Saint-André-de-Cubzac',votants:0},
 {...base,id:'2026_muni_t1',annee:2026,codeInsee:'33366',commune:'Saint-André-de-Cubzac',votants:null}
]};
test.use({serviceWorkers:'block'});
test('indicateur communal : complément, CSV, vues v1/v2 et références périmées',async({page},testInfo)=>{
 test.setTimeout(60000);
 await page.route('**/data/elections-2008-2026.json.gz*',route=>route.fulfill({body:gzipSync(JSON.stringify(dataset)),contentType:'application/octet-stream'}));
 await page.addInitScript(({key,view})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify([view,{...view,id:'perimee',version:2,measure:'abstention',ballotB:'scrutin-retire'}]));},{key:KEY,view:legacy});
 const open=()=>page.locator('.sidebar [data-nav=analyse]:visible, .mobile-nav [data-nav=analyse]:visible').first().click();
 await page.goto('/');await open();
 await page.locator('[data-comparison-id=ancienne][data-action=open-comparison-view]').click();
 await expect(page.locator('#analysis-measure')).toHaveValue('participation');
 const table=page.locator('#territory-comparison-table');
 await expect(table.locator('tbody tr').first().locator('td').last()).toHaveText('-50,0 points');
 await page.locator('#analysis-measure').selectOption('abstention');
 await expect(table.locator('thead')).toContainText('Écart B − A · abstention');
 await expect(table.locator('tbody tr').first().locator('td').last()).toHaveText('+50,0 points');
 await expect(table.locator('tbody tr').nth(1).locator('td').nth(3)).toHaveText('100,0 %');
 await expect(table.locator('tbody tr').nth(1).locator('td').nth(7)).toHaveText('—');
 await expect(table.locator('tbody tr').nth(1).locator('td').last()).toHaveText('—');
 await expect(page.locator('.territory-bars-list')).toHaveAttribute('aria-label',/Abstention comparée/);
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('[data-action=export-territory-comparison]').click()]);
 const csv=await readFile(await download.path(),'utf8');
 expect(csv).toContain('indicateur;valeur_a;valeur_b;unite');expect(csv).toContain('abstention;50,00;100,00;');
 expect(csv).toContain('abstention;100,00;;');
 await page.locator('[data-action=save-comparison-view]').click();
 const views=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
 const saved=views.find(v=>v.version===2&&v.measure==='abstention'&&v.ballotB==='2026_muni_t1');
 expect(saved).toBeTruthy();expect(views.find(v=>v.id==='ancienne')).toEqual(legacy);
 await page.locator('[data-action=save-comparison-view]').click();await expect(page.locator('.notice')).toContainText('déjà enregistrée');
 await page.reload();await open();
 await page.locator('#analysis-measure').selectOption('participation');
 await page.locator(`[data-comparison-id="${saved.id}"][data-action=open-comparison-view]`).click();
 await expect(page.locator('#analysis-measure')).toHaveValue('abstention');
 await page.locator('[data-comparison-id=perimee][data-action=open-comparison-view]').click();
 await expect(page.locator('.notice')).toContainText('plus dans les données');
 await expect(page.locator('#analysis-measure')).toHaveValue('abstention');
 await expect(page.locator('#analysis-ballot-b')).toHaveValue('2026_muni_t1');
 await mkdir('test-results/captures',{recursive:true});
 await page.locator('.territory-bars-list').screenshot({path:`test-results/captures/mesure-abstention-${testInfo.project.name}.png`});
 await page.locator(`[data-comparison-id="${saved.id}"][data-action=delete-comparison-view]`).click();
 expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).map(v=>v.id),KEY)).toEqual(['ancienne','perimee']);
 await expect(page.locator('[data-action=new-mission-from-map]')).toHaveCount(0);
});
