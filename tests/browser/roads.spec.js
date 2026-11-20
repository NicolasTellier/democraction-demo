import {openManualMission, seedLegacyGeometryMission} from '../helpers/mission-simulation.js';
import {test,expect} from '@playwright/test';

test.use({serviceWorkers:'block'});

test('voies IGN linéaires, sélection multiple et action géométrique préexistante conservée',async({page})=>{
 await page.goto('/');
 await page.locator('button[data-nav=carte]:visible').first().click();
 await page.locator('#map-scope-value').selectOption('Saint-André-de-Cubzac');
 await expect(page.locator('.map-rail')).toContainText('303 voies linéaires',{timeout:20000});
 await expect.poll(()=>page.locator('#map .road-line').count(),{timeout:20000}).toBeGreaterThan(200);
 await page.locator('#street-search-form [name=query]').fill('Rue Elie Faure');
 await page.locator('#street-search-form button').click();
 await page.locator('.street-result').filter({hasText:'Rue Elie Faure'}).click();
 await expect.poll(()=>page.locator('#map .road-selected').count(),{timeout:20000}).toBeGreaterThan(0);
 await expect.poll(()=>page.locator('#map .leaflet-tile').first().getAttribute('src').then(src=>Number(src?.match(/TILEMATRIX=(\d+)/)?.[1]||0)),{timeout:20000}).toBeGreaterThanOrEqual(14);
 await expect(page.locator('.map-selection-summary')).toContainText('Rue · Rue Elie Faure');
 await page.locator('#street-search-form [name=query]').fill('Rue Nationale');
 await page.locator('#street-search-form button').click();
 await page.locator('.street-result').filter({has:page.locator('strong',{hasText:/^Rue Nationale$/})}).click();
 await expect(page.locator('.street-chip')).toHaveCount(2);
 await expect(page.locator('[data-action=new-mission-from-map]')).toHaveCount(0);
 await seedLegacyGeometryMission(page,{title:'Tournée fictive des deux rues',zoneKind:'streets',roadIds:['33366_0265','33366_0750'],zoneGeometry:{type:'MultiLineString',coordinates:[[[-0.4332,44.9985],[-0.432,44.9985]],[[-0.431,45],[-0.430,45]]]}});
 const mission=await page.evaluate(()=>JSON.parse(localStorage.getItem('democraction-v1-local')).missions.find(m=>m.title==='Tournée fictive des deux rues'));
 expect(mission.roadIds).toEqual(['33366_0265','33366_0750']);
 expect(mission.zoneKind).toBe('streets');
 expect(mission.zoneGeometry.type).toBe('MultiLineString');
 await page.reload();
 await page.locator('button[data-nav=carte]:visible').first().click();
 await expect.poll(()=>page.locator('#map .leaflet-interactive[stroke="#1e3ac8"]').count(),{timeout:20000}).toBeGreaterThan(0);
 await page.locator('button[data-nav=actions]:visible').first().click();
 await expect(page.getByText('Tournée fictive des deux rues')).toBeVisible();
});

test('adresse publique BAN ouverte sans fiche nominative',async({page})=>{
 await page.route('https://data.geopf.fr/wfs/ows**',async route=>{
  const url=new URL(route.request().url());
  if(url.searchParams.get('TYPENAMES')!=='BAN.DATA.GOUV:ban')return route.continue();
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({type:'FeatureCollection',numberMatched:1,features:[{type:'Feature',id:'33366_0265_00001',geometry:{type:'Point',coordinates:[-.4332,44.9985]},properties:{id:'33366_0265_00001',code_insee:'33366',id_fantoir:'33366_0265',nom_voie:'Rue Elie Faure',numero:1,rep:'',code_postal:'33240',nom_commune:'Saint-André-de-Cubzac',certification_commune:1}}]})});
 });
 await page.goto('/');
 await page.locator('button[data-nav=carte]:visible').first().click();
 await page.locator('#map-scope-value').selectOption('Saint-André-de-Cubzac');
 await expect(page.locator('.map-rail')).toContainText('303 voies linéaires',{timeout:20000});
 await page.locator('#street-search-form [name=query]').fill('Rue Elie Faure');
 await page.locator('#street-search-form button').click();
 await page.locator('.street-result').filter({hasText:'Rue Elie Faure'}).click();
 await page.locator('[data-action=show-addresses]').click();
 await expect(page.locator('.ban-address')).toHaveCount(1,{timeout:20000});
 await page.locator('.ban-address').click();
 await expect(page.locator('.map-detail .panel')).toContainText('1 Rue Elie Faure');
 await expect(page.locator('.map-detail .panel')).toContainText('Aucun nom, contact, vote ou opinion');
});

test('points BAN chargés au zoom dans la zone visible sans sélectionner de rue',async({page})=>{
 let viewportRequests=0;
 await page.route('https://data.geopf.fr/wfs/ows**',async route=>{
  const url=new URL(route.request().url()),filter=url.searchParams.get('CQL_FILTER')||'';
  if(url.searchParams.get('TYPENAMES')!=='BAN.DATA.GOUV:ban'||!filter.includes('BBOX(geom,'))return route.continue();
  viewportRequests++;
  const b=filter.match(/BBOX\(geom,([^,]+),([^,]+),([^,]+),([^,]+),/);
  if(!b)throw new Error('Emprise BAN absente');
  const lon=(Number(b[1])+Number(b[3]))/2,lat=(Number(b[2])+Number(b[4]))/2;
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({type:'FeatureCollection',numberMatched:1,features:[{type:'Feature',geometry:{type:'Point',coordinates:[lon,lat]},properties:{id:'ban-test-visible',code_insee:'33366',nom_voie:'Rue du test',numero:8,code_postal:'33240',nom_commune:'Saint-André-de-Cubzac'}}]})});
 });
 await page.goto('/');
 await page.locator('button[data-nav=carte]:visible').first().click();
 await page.locator('#map-scope-value').selectOption('Saint-André-de-Cubzac');
 await expect(page.locator('.map-rail')).toContainText('303 voies linéaires',{timeout:20000});
 await expect(page.locator('.street-chip')).toHaveCount(0);
 for(let i=0;i<12;i++){
  const current=Number(await page.locator('#map').getAttribute('data-zoom'));
  if(current>=16)break;
  await page.locator('#map .leaflet-control-zoom-in').click();
  await expect.poll(async()=>Number(await page.locator('#map').getAttribute('data-zoom'))).toBeGreaterThan(current);
 }
 await expect.poll(async()=>Number(await page.locator('#map').getAttribute('data-zoom')),{timeout:10000}).toBeGreaterThanOrEqual(16);
 await expect.poll(()=>viewportRequests,{timeout:20000}).toBeGreaterThan(0);
 await expect(page.locator('#map .ban-address')).toHaveCount(1,{timeout:20000});
 if(['iphone','android'].includes(test.info().project.name))await page.locator('#map .ban-address').tap();
 else await page.locator('#map .ban-address').click();
 await expect(page.locator('.map-detail .panel')).toContainText('8 Rue du test');
 await expect(page.locator('.map-detail .panel')).toContainText('Aucun nom, contact, vote ou opinion');
});
