import {test,expect} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
import {parseCsv} from '../../app/core.js';
const reference=JSON.parse(await readFile(new URL('../fixtures/participation-difference-real.json',import.meta.url),'utf8'));
const KEY='democraction-demo-comparison-views';
const legacy={version:1,id:'legacy-real',ballotA:reference.scenarios[0].first,ballotB:reference.scenarios[0].second,type:'muni',tour:'t1',communeCodes:['33001','33366'],savedAt:'2026-11-20T10:00:00Z',source:reference.source,sourceDate:reference.updated};
const pct=n=>n===null?'—':n.toFixed(1).replace('.',',')+' %';
const selectedValue=(n,measure)=>n===null?null:measure==='abstention'?100-n:n;
const decimal=s=>s===''?null:Number(s.replace(/^'/,'').replace(',','.'));
test.use({serviceWorkers:'block'});

test('mesures réelles : cinq couples, filtres, export, zéro/absence et rappel v1/v2',async({page},info)=>{
 test.setTimeout(90000);
 await page.addInitScript(({key,view})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify([view]));},{key:KEY,view:legacy});
 await page.goto('/');
 const open=()=>page.locator('.sidebar [data-nav=analyse]:visible, .mobile-nav [data-nav=analyse]:visible').first().click();
 await open();
 const table=page.locator('#territory-comparison-table');
 let savedId;
 for(let i=0;i<reference.scenarios.length;i++){
  const scenario=reference.scenarios[i],codes=i===4?['33001','33166']:['33001','33366'];
  await page.locator('#election-type').selectOption(scenario.first.split('_')[1]);
  await page.locator('#election-tour').selectOption(scenario.first.split('_')[2]);
  await page.locator('#election-year').selectOption(scenario.second.split('_')[0]);
  await page.locator('#analysis-ballot-a').selectOption(scenario.first);
  await page.locator('#analysis-ballot-b').selectOption(scenario.second);
  const checked=await page.locator('input[name=analysis-commune]:checked').evaluateAll(nodes=>nodes.map(n=>n.value));
  for(const c of checked)await page.locator(`input[name=analysis-commune][value="${c}"]`).uncheck();
  for(const c of codes)await page.locator(`input[name=analysis-commune][value="${c}"]`).check();
  for(const measure of ['participation','abstention']){
   await page.locator('#analysis-measure').selectOption(measure);
   await expect(page.locator('#analysis-ballot-a')).toHaveValue(scenario.first);
   await expect(page.locator('#analysis-ballot-b')).toHaveValue(scenario.second);
   await expect(table.locator('tbody tr')).toHaveCount(2);
   await expect(table.locator('thead')).toContainText('Écart B − A · '+measure);
   for(const code of codes){
    const item=scenario.items.find(x=>x.code===code),row=table.locator('tbody tr').filter({has:page.getByRole('rowheader',{name:item.name,exact:true})});
    const a=selectedValue(item.a,measure),b=selectedValue(item.b,measure),delta=item.delta===null?null:item.delta*(measure==='abstention'?-1:1);
    await expect(row.locator('td').nth(measure==='abstention'?3:2)).toHaveText(pct(a));
    await expect(row.locator('td').nth(measure==='abstention'?7:6)).toHaveText(pct(b));
    await expect(row.locator('td').last()).toHaveText(delta===null?'—':(delta>=0?'+':'')+delta.toFixed(1).replace('.',',')+' points');
    const bar=page.locator('.territory-bars').filter({has:page.getByText(item.name,{exact:true})});
    for(const [index,value] of [[0,a],[1,b]]){
     await expect(bar.locator('.territory-bars-row').nth(index)).toContainText(pct(value));
     const width=Number((await bar.locator('i').nth(index).getAttribute('style')).replace('width:','').replace('%',''));
     expect(width).toBeCloseTo(value??0,9);
    }
   }
   if(i===0||measure==='abstention'&&(i===2||i===4)){
    const [download]=await Promise.all([page.waitForEvent('download'),page.locator('[data-action=export-territory-comparison]').click()]);
    const records=parseCsv(await readFile(await download.path(),'utf8')).rows;
    expect(records).toHaveLength(2);
    for(const record of records){
     const item=scenario.items.find(x=>x.code===record.code_insee),expected=[selectedValue(item.a,measure),selectedValue(item.b,measure),item.delta===null?null:item.delta*(measure==='abstention'?-1:1)];
     expect(codes).toContain(record.code_insee);expect(record.indicateur).toBe(measure);
     expect(record.source).toBe(reference.source);expect(record.mise_a_jour).toBe(reference.updated);
     for(const [index,key] of ['valeur_a','valeur_b','ecart_b_moins_a'].entries()){
      const actual=decimal(record[key]);if(expected[index]===null)expect(actual).toBeNull();else expect(Math.abs(actual-expected[index])).toBeLessThanOrEqual(.005000001);
     }
    }
   }
  }
  if(i===0){
   await page.locator('[data-action=save-comparison-view]').click();
   savedId=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).find(v=>v.version===2).id,KEY);
  }
  if(i===2||i===4){await mkdir('test-results/captures',{recursive:true});await page.locator('.territory-bars-list').screenshot({path:`test-results/captures/mesures-reelles-${i===2?'absence':'zero'}-${info.project.name}.png`});}
 }
 await page.reload();await open();
 await page.locator('#filter-commune').selectOption('Bourg');
 await page.locator(`[data-comparison-id="${savedId}"][data-action=open-comparison-view]`).click();
 await expect(page.locator('#analysis-measure')).toHaveValue('abstention');
 await expect(page.locator('#election-type')).toHaveValue('muni');await expect(page.locator('#election-tour')).toHaveValue('t1');
 await expect(page.locator('#filter-commune')).toHaveValue('');
 await expect(page.locator('input[name=analysis-commune]:checked')).toHaveCount(2);
 await page.locator('[data-comparison-id=legacy-real][data-action=open-comparison-view]').click();
 await expect(page.locator('#analysis-measure')).toHaveValue('participation');
 await expect(page.locator('#analysis-ballot-a')).toHaveValue(reference.scenarios[0].first);
 expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).find(v=>v.id==='legacy-real'),KEY)).toEqual(legacy);
 await expect(page.locator('[data-action=new-mission-from-map]')).toHaveCount(0);
});
