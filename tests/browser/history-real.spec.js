import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

test.use({serviceWorkers:'block'});

const scenarios=[
 {type:'muni',tour:'t1',scope:'',label:'Municipales · 1er tour',rows:[[2008,17859,12324,4],[2014,87486,59248,87],[2020,95196,46520,87],[2026,102177,62381,87]]},
 {type:'pres',tour:'t1',scope:'',label:'Présidentielles · 1er tour',rows:[[2012,85821,71046,87],[2017,92055,73465,87],[2022,98441,76370,87]]},
 {type:'pres',tour:'t2',scope:'Abzac',label:'Présidentielles · 2e tour',rows:[[2012,1414,1118,1],[2017,1471,1070,1],[2022,1533,1137,1]]},
 {type:'legi',tour:'t2',scope:'Abzac',label:'Législatives · 2e tour',rows:[[2012,1412,722,1],[2017,1469,570,1],[2022,1540,662,1]]}
];
const pct=value=>value.toFixed(1).replace('.',',')+' %';
const number=value=>new Intl.NumberFormat('fr-FR').format(value);

test('historique réel : scrutins, tours, périmètres et concordance courbe barres tableau',async({page},testInfo)=>{
 test.skip(!['desktop','iphone'].includes(testInfo.project.name));
 await page.goto('/');
 await page.locator('button[data-nav="analyse"]:visible').first().click();
 const panel=page.locator('.panel').filter({has:page.getByRole('heading',{name:'Évolution de la participation et de l’abstention',exact:true})});
 const table=panel.getByRole('table',{name:'Valeurs exactes du graphique historique'});
 for(const scenario of scenarios){
  await page.locator('#filter-commune').selectOption(scenario.scope);
  await page.locator('#election-type').selectOption(scenario.type);
  await page.locator('#election-tour').selectOption(scenario.tour);
  await page.locator('#election-year').selectOption(String(scenario.rows.at(-1)[0]));
  await expect(panel.locator('.election-timeline')).toHaveAttribute('aria-label',new RegExp(scenario.label));
  await expect(table.locator('tbody tr')).toHaveCount(scenario.rows.length);
  await expect(panel.locator('.timeline-point-participation')).toHaveCount(scenario.rows.length);
  await panel.getByText('Voir l’historique en barres',{exact:true}).click();
  await expect(panel.locator('.history-bars-year')).toHaveCount(scenario.rows.length);
  await panel.getByText('Voir l’historique en barres empilées',{exact:true}).click();
  await expect(panel.locator('.history-stacked-year')).toHaveCount(scenario.rows.length);
  await panel.getByText('Voir l’historique en aires empilées',{exact:true}).click();
  await expect(panel.locator('.history-area-year')).toHaveCount(scenario.rows.length);
  for(let i=0;i<scenario.rows.length;i++){
   const [year,registered,voters,communes]=scenario.rows[i];
   const participation=100*voters/registered,abstention=100*(registered-voters)/registered;
   const cells=table.locator('tbody tr').nth(i);
   await expect(cells.locator('th')).toHaveText(String(year));
   await expect(cells.locator('td').nth(0)).toHaveText(String(communes));
   await expect(cells.locator('td').nth(1)).toHaveText(number(registered));
   await expect(cells.locator('td').nth(2)).toHaveText(pct(participation));
   await expect(cells.locator('td').nth(3)).toHaveText(pct(abstention));
   const point=panel.locator('.timeline-point-participation').nth(i);
   expect(Number(await point.getAttribute('cy'))).toBeCloseTo(190-1.5*participation,10);
   const bars=panel.locator('.history-bars-year[data-year="'+year+'"]');
   await expect(bars).toContainText(communes+' commune(s) · '+number(registered)+' inscrits');
   await expect(bars.locator('.history-bar-row').nth(0)).toContainText(pct(participation));
   await expect(bars.locator('.history-bar-row').nth(1)).toContainText(pct(abstention));
   const width=await bars.locator('.history-bar-participation').getAttribute('style');
   expect(Number(width.replace('width:','').replace('%',''))).toBeCloseTo(participation,10);
   const stacked=panel.locator('.history-stacked-year[data-year="'+year+'"]');
   await expect(stacked).toContainText(pct(participation));
   await expect(stacked).toContainText(pct(abstention));
   const partWidth=Number((await stacked.locator('.history-stacked-participation').getAttribute('style')).replace('width:','').replace('%',''));
   const abstWidth=Number((await stacked.locator('.history-stacked-abstention').getAttribute('style')).replace('width:','').replace('%',''));
   expect(partWidth).toBeCloseTo(participation,10);expect(abstWidth).toBeCloseTo(abstention,10);
   expect(partWidth+abstWidth).toBeCloseTo(100,10);
   const area=panel.locator('.history-area-year[data-year="'+year+'"]');
   await expect(area).toContainText(pct(participation));await expect(area).toContainText(pct(abstention));
   expect(Number(await panel.locator('.history-area-point').nth(i).getAttribute('cy'))).toBeCloseTo(190-1.5*participation,10);


  }
  await expect(panel).toContainText('Source : data.gouv.fr / ministère de l’Intérieur');
  await expect(panel).toContainText('mise à jour 2026-07-07');
  await expect(panel).toContainText('ne mesurent pas des transferts individuels');
 }
 await mkdir('test-results/captures',{recursive:true});
 await panel.screenshot({path:'test-results/captures/history-real-'+testInfo.project.name+'.png'});
 await page.locator('#election-type').selectOption('euro');
 await page.locator('#election-tour').selectOption('t2');
 await expect(panel).toContainText('Il faut au moins deux années comparables');
 await expect(panel.locator('.election-timeline')).toHaveCount(0);
 await expect(panel.locator('.history-bars')).toHaveCount(0);
 await expect(panel.locator('.history-stacked')).toHaveCount(0);
 await expect(panel.locator('.history-area')).toHaveCount(0);
});
