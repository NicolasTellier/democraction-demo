import {test,expect} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
test.use({serviceWorkers:'block'});
const reference=JSON.parse(await readFile(new URL('../fixtures/participation-difference-real.json',import.meta.url),'utf8'));
const colors={missing:'#c8d0d7',zero:'#f7f7f7',positive:'#2166ac',negative:'#b35806'};
const expectedColor=value=>value===null?colors.missing:value===0?colors.zero:value>0?colors.positive:colors.negative;
const normalize=value=>value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase();

test('carte d’écart réelle : cinq couples, 2008/2026, zéro, filtres et orientations',async({page},testInfo)=>{
 test.skip(!['desktop','iphone'].includes(testInfo.project.name));
 test.setTimeout(90000);
 await page.goto('/');
 await page.locator('button[data-nav="carte"]:visible').first().click();
 await page.locator('#map-layer').selectOption('participation-difference');
 const choose=async scenario=>{
  await page.locator('#difference-a').selectOption(scenario.first);
  await expect(page.locator('#difference-a')).toHaveValue(scenario.first);
  await page.locator('#difference-b').selectOption(scenario.second);
  await expect(page.locator('#difference-b')).toHaveValue(scenario.second);
 };
 const check=async items=>{
  await expect.poll(async()=>{
   const actual=await page.locator('#map [data-commune-code]').evaluateAll(nodes=>nodes.map(node=>({
    code:node.getAttribute('data-commune-code'),value:node.getAttribute('data-map-value'),fill:node.getAttribute('fill')
   })));
   return actual.length===items.length&&items.every(item=>{
    const row=actual.find(x=>x.code===item.code);
    return row&&row.fill===expectedColor(item.delta)&&(item.delta===null?row.value==='missing':row.value!=='missing'&&Math.abs(Number(row.value)-item.delta)<1e-9);
   });
  },{message:'Les valeurs et couleurs SVG doivent correspondre aux références indépendantes'}).toBe(true);
  const paired=items.filter(item=>item.delta!==null).length;
  await expect(page.locator('[data-difference-coverage]')).toContainText(paired+'/'+items.length+' communes');
  const legend=page.locator('#map .map-legend');
  await expect(legend).toContainText('B − A');await expect(legend).toContainText('centrées sur zéro');
  await expect(legend).toContainText(reference.source);await expect(legend).toContainText(reference.updated);
  await expect(page.locator('#insee-grid-resolution')).toBeDisabled();
 };
 const capture=async name=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.locator('#map').evaluate(element=>element.scrollIntoView({block:'center',behavior:'instant'}));
  const legend=await page.locator('#map .map-legend').boundingBox();
  const attribution=await page.locator('#map .leaflet-control-attribution').boundingBox();
  expect(attribution.y+attribution.height).toBeLessThanOrEqual(legend.y);
  await mkdir('test-results/captures',{recursive:true});
  await page.screenshot({path:'test-results/captures/difference-real-'+name+'-'+testInfo.project.name+'.png'});
 };
 for(let index=0;index<reference.scenarios.length;index++){
  const scenario=reference.scenarios[index];
  await choose(scenario);await check(scenario.items);
  if(index===0)await capture('communes');
  if(index===2){
   await page.locator('#filter-query').fill('Abzac');
   const subset=scenario.items.filter(item=>normalize(item.name).includes('abzac'));
   expect(subset).toHaveLength(2);expect(subset.every(item=>item.delta===null)).toBe(true);
   await check(subset);
   await page.locator('#filter-query').fill('');await check(scenario.items);
  }
 }
 const zero=reference.scenarios.at(-1).items.find(item=>item.delta===0);
 expect(zero.code).toBe('33166');
 await expect(page.locator('#map [data-commune-code="33166"]')).toHaveAttribute('data-map-value','0');
 await capture('zero');
 // Le mode historique utilise les pourcentages publiés arrondis et son signe A − B.
 const legacy=reference.scenarios[3];
 await choose(legacy);await check(legacy.items);
 await page.locator('[data-map-mode="compare"]').click();
 await expect(page.locator('.map-compare-table strong')).toContainText('Écarts A − B');
 for(const code of ['33001','33067','33114','33366']){
  const item=legacy.items.find(row=>row.code===code);
  const row=page.locator('.map-compare-table tbody tr').filter({has:page.getByRole('cell',{name:item.name,exact:true})});
  const delta=item.storedA-item.storedB;
  await expect(row.locator('td').nth(1)).toHaveText(item.storedA.toFixed(1));
  await expect(row.locator('td').nth(2)).toHaveText(item.storedB.toFixed(1));
  await expect(row.locator('td').nth(3)).toHaveText((delta>=0?'+':'')+delta.toFixed(1));
 }
 await expect(page.locator('#map-left .map-legend')).toContainText('Participation électorale');
 await expect(page.locator('#map-left .map-legend')).not.toContainText('centrées sur zéro');
});
