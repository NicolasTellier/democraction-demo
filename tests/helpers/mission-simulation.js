import {expect} from '@playwright/test';
import {emptyState} from '../../app/core.js';

export async function openManualMission(page,title,commune='Saint-André-de-Cubzac'){
 await page.locator('.sidebar [data-nav=actions]:visible, .mobile-nav [data-nav=actions]:visible').first().click();
 await page.locator('[data-action=new-mission]').click();
 await expect(page.locator('#mission-commune')).toHaveValue('');
 await expect(page.locator('#mission-form [name=secteur]')).toHaveValue('');
 await page.locator('#mission-commune').selectOption(commune);
 await page.locator('#mission-form [name=title]').fill(title);
}

// A pre-existing synthetic backup fixture, never a production creation path.
// Keeps regression coverage of editing/rendering stored geometries after removal
// of analytical-map-to-action creation.
export async function seedLegacyGeometryMission(page,values={}){
 await page.evaluate(({values,initial})=>{
  const key='democraction-v1-local',app=JSON.parse(localStorage.getItem(key))||initial;
  app.missions.push({id:'legacy-geometry-'+app.missions.length,campaignId:app.current,
   title:'Action géométrique fictive préexistante',commune:'Saint-André-de-Cubzac',
   type:'Distribution',status:'À faire',zoneKind:'commune',zoneId:'33366',
   zoneCommunes:['Saint-André-de-Cubzac'],roadIds:[],rues:[],tags:[],
   zoneGeometry:{type:'Polygon',coordinates:[[[-.434,44.998],[-.430,44.998],[-.430,45.002],[-.434,45.002],[-.434,44.998]]]},
   created:'2026-11-20T06:00:00.000Z',...values});
  localStorage.setItem(key,JSON.stringify(app));
 },{values,initial:emptyState()});
 await page.reload();
 await page.locator('button[data-nav=carte]:visible').first().click();
}
