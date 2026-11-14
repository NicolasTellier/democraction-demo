import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {mkdirSync} from 'node:fs';

test.use({serviceWorkers:'block'});
const kml=readFileSync(new URL('../fixtures/bureau.kml',import.meta.url));
const kmz=readFileSync(new URL('../fixtures/bureau.kmz',import.meta.url));

for(const [extension,body,mime] of [
 ['kml',kml,'application/vnd.google-earth.kml+xml'],
 ['kmz',kmz,'application/vnd.google-earth.kmz']
]) test(`import ${extension.toUpperCase()} : bureau, provenance et persistance`,async({page},testInfo)=>{
 await page.goto('/');
 await page.locator('button[data-nav=carte]:visible').first().click();
 await page.locator('#map-scope').selectOption('bureau');
 await page.locator('#bureau-commune').selectOption('Saint-André-de-Cubzac');
 await page.locator('#bureau-source').fill('Carte de recette transmise localement');
 await page.locator('#bureau-import').setInputFiles({name:`bureau.${extension}`,mimeType:mime,buffer:body});
 await expect(page.locator('.notice')).toContainText('1 contour(s) importé(s)');
 await page.locator('#map-scope-value').selectOption('33366-1');
 await expect(page.locator('.map-detail .panel')).toContainText('Carte de recette transmise localement');
 await expect(page.locator('.map-detail .panel')).toContainText('À confirmer');
 await expect.poll(()=>page.locator('#map .leaflet-interactive[stroke="#ee4b23"]').count(),{timeout:20000}).toBeGreaterThan(0);
 if(extension==='kmz'){
  mkdirSync('test-results/captures',{recursive:true});
  await page.screenshot({path:`test-results/captures/bureau-kmz-${testInfo.project.name}.png`});
 }
 await page.reload();
 await page.locator('button[data-nav=carte]:visible').first().click();
 await page.locator('#map-scope').selectOption('bureau');
 await page.locator('#map-scope-value').selectOption('33366-1');
 await expect(page.locator('.map-detail .panel')).toContainText('Carte de recette transmise localement');
});

test('GeoJSON : import cumulatif, refus des lignes et source conservée',async({page})=>{
 await page.goto('/');
 await page.locator('button[data-nav=carte]:visible').first().click();
 await page.locator('#map-scope').selectOption('bureau');
 const feature=(id,geometry)=>({type:'Feature',properties:{id,codeInsee:'33366',nom:id},geometry});
 const polygon={type:'Polygon',coordinates:[[[-.49,45.02],[-.47,45.02],[-.47,45.04],[-.49,45.04],[-.49,45.02]]]};
 const upload=async(id,geometry)=>page.locator('#bureau-import').setInputFiles({name:`${id}.geojson`,mimeType:'application/geo+json',buffer:Buffer.from(JSON.stringify({type:'FeatureCollection',features:[feature(id,geometry)]}))});
 await upload('33366-1',polygon);
 await expect(page.locator('.notice')).toContainText('1 contour(s) importé(s)');
 await upload('33366-2',polygon);
 await expect(page.locator('.map-rail')).toContainText('2 contour(s) importé(s)');
 await upload('33366-3',{type:'LineString',coordinates:[[-.49,45.02],[-.47,45.02]]});
 await expect(page.locator('.notice')).toContainText('Import des bureaux refusé');
 await expect(page.locator('.map-rail')).toContainText('2 contour(s) importé(s)');
});
