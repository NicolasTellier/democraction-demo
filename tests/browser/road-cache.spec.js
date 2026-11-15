import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';

test.use({serviceWorkers:'block'});

test('87 paquets IGN consultables par commune, audit BAN et zoom conservé',async({page},testInfo)=>{
 const loaded=[],wfs=[];
 page.on('request',request=>{
  if(/\/data\/voies-33\d{3}\.geojson\.gz/.test(request.url()))loaded.push(request.url());
  if(request.url().includes('data.geopf.fr/wfs/ows')&&request.url().includes('voie_nommee'))wfs.push(request.url());
 });
 await page.goto('/');
 await page.locator('button[data-nav=carte]:visible').first().click();
 await expect(page.locator('.road-inventory')).toContainText('87 / 87');
 await expect(page.locator('.road-inventory')).toContainText('1 115 noms de voie BAN sans tracé IGN');
 await page.locator('#map-scope-value').selectOption('Abzac');
 await expect(page.locator('.map-rail')).toContainText('99 voies linéaires',{timeout:20000});
 await expect(page.locator('.road-inventory')).toContainText('Abzac : 1 nom(s) BAN sans ligne rapprochée');
 expect(wfs).toHaveLength(0);
 expect(loaded.some(url=>url.includes('voies-33001.geojson.gz'))).toBe(true);
 expect(loaded.some(url=>url.includes('voies-33006.geojson.gz'))).toBe(false);
 await page.locator('#street-search-form [name=query]').fill('BARRAUD');
 await page.locator('#street-search-form button').click();
 await page.locator('.street-result').filter({hasText:'BARRAUD'}).first().click();
 await expect.poll(()=>page.locator('#map .road-selected').count()).toBeGreaterThan(0);
 mkdirSync('test-results/captures',{recursive:true});
 await page.screenshot({path:`test-results/captures/voies-0-15-${testInfo.project.name}.png`});
 const before=Number(await page.locator('#map').getAttribute('data-zoom'));
 await page.locator('#map .leaflet-control-zoom-in').click();
 await expect.poll(async()=>Number(await page.locator('#map').getAttribute('data-zoom'))).toBe(before+1);
 const zoom=await page.locator('#map').getAttribute('data-zoom');
 const center=await page.locator('#map').getAttribute('data-center');
 await page.locator('#map-layer').selectOption('population');
 await expect.poll(()=>page.locator('#map').getAttribute('data-zoom')).toBe(zoom);
 await expect(page.locator('#map')).toHaveAttribute('data-center',center);
});

test('un fichier de commune absent bascule sur le WFS sans inventer de tracé',async({page})=>{
 let calls=0;
 await page.route('**/data/voies-33001.geojson.gz',route=>route.fulfill({status:404}));
 await page.route('https://data.geopf.fr/wfs/ows**',async route=>{
  const url=new URL(route.request().url());
  if(url.searchParams.get('TYPENAMES')!=='BDTOPO_V3:voie_nommee')return route.continue();
  calls++;
  const feature={type:'Feature',id:'33001_0001',properties:{id:'33001_0001',insee_commune:'33001',nom_voie_ban:'Rue de la recette'},geometry:{type:'LineString',coordinates:[[-.123,45.01],[-.122,45.011]]}};
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({type:'FeatureCollection',numberMatched:1,features:[feature]})});
 });
 await page.goto('/');
 await page.locator('button[data-nav=carte]:visible').first().click();
 await page.locator('#map-scope-value').selectOption('Abzac');
 await expect(page.locator('.map-rail')).toContainText('1 voies linéaires',{timeout:20000});
 await expect(page.locator('.map-rail')).toContainText('WFS');
 expect(calls).toBe(1);
});
