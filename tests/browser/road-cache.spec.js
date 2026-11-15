import {test,expect} from '@playwright/test';

test.use({serviceWorkers:'block'});

test('voies d’une autre commune conservées après réouverture, zoom stable après ouverture de fiche',async({page})=>{
 let calls=0;
 await page.route('https://data.geopf.fr/wfs/ows**',async route=>{
  const url=new URL(route.request().url());
  if(url.searchParams.get('TYPENAMES')!=='BDTOPO_V3:voie_nommee')return route.continue();
  calls++;
  const code=url.searchParams.get('CQL_FILTER')?.match(/'([^']+)'/)?.[1];
  if(code!=='33001')return route.abort();
  const feature={type:'Feature',id:'33001_0001',properties:{id:'33001_0001',insee_commune:code,nom_voie_ban:'Rue de la recette'},geometry:{type:'LineString',coordinates:[[-.123,45.01],[-.122,45.011]]}};
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({type:'FeatureCollection',numberMatched:1,features:[feature]})});
 });
 await page.goto('/');
 await page.locator('button[data-nav=carte]:visible').first().click();
 await expect(page.locator('.road-inventory')).toContainText('1 / 87');
 await page.locator('#map-scope-value').selectOption('Abzac');
 await expect(page.locator('.map-rail')).toContainText('1 voies linéaires',{timeout:20000});
 await expect(page.locator('.road-inventory')).toContainText('2 / 87');
 expect(calls).toBe(1);
 await page.locator('#street-search-form [name=query]').fill('Rue de la recette');
 await page.locator('#street-search-form button').click();
 await page.locator('.street-result').first().click();
 await expect.poll(()=>page.locator('#map .road-selected').count()).toBeGreaterThan(0);
 await page.locator('#map .leaflet-control-zoom-in').click();
 await expect.poll(async()=>Number((await page.locator('#map .leaflet-tile').first().getAttribute('src'))?.match(/TILEMATRIX=(\d+)/)?.[1])).toBeGreaterThanOrEqual(16);
 const zoom=await page.locator('#map .leaflet-tile').first().getAttribute('src').then(src=>src?.match(/TILEMATRIX=(\d+)/)?.[1]);
 await page.locator('#map-layer').selectOption('population');
 await expect.poll(()=>page.locator('#map .leaflet-tile').first().getAttribute('src').then(src=>src?.match(/TILEMATRIX=(\d+)/)?.[1])).toBe(zoom);
 await page.reload();
 await page.locator('button[data-nav=carte]:visible').first().click();
 await expect(page.locator('.road-inventory')).toContainText('2 / 87');
 await expect(page.locator('.map-rail')).toContainText('1 voies linéaires',{timeout:20000});
 expect(calls).toBe(1);
});

test('préchargement limité à cinq communes et inventaire persistant',async({page})=>{
 const requested=[];
 await page.route('https://data.geopf.fr/wfs/ows**',async route=>{
  const url=new URL(route.request().url());
  if(url.searchParams.get('TYPENAMES')!=='BDTOPO_V3:voie_nommee')return route.continue();
  const code=url.searchParams.get('CQL_FILTER')?.match(/'([^']+)'/)?.[1];
  requested.push(code);
  const feature={type:'Feature',id:`${code}_001`,properties:{id:`${code}_001`,insee_commune:code,nom_voie_ban:'Voie témoin'},geometry:{type:'LineString',coordinates:[[-.5,45],[-.49,45.01]]}};
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({type:'FeatureCollection',numberMatched:1,features:[feature]})});
 });
 await page.goto('/');
 await page.locator('button[data-nav=carte]:visible').first().click();
 await page.locator('[data-action=road-prefetch]').click();
 await expect(page.locator('.road-inventory')).toContainText('6 / 87',{timeout:25000});
 expect(requested).toHaveLength(5);
 await page.reload();
 await page.locator('button[data-nav=carte]:visible').first().click();
 await expect(page.locator('.road-inventory')).toContainText('6 / 87');
});
