import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {emptyState} from '../../app/core.js';

test.use({serviceWorkers:'block'});

const APP_KEY='democraction-v1-local';
const SAINT_ANDRE='Saint-André-de-Cubzac';
const CUBZAC='Cubzac-les-Ponts';
const MULTI_TITLE='Tournée logistique de recette';
const METRICS=['total','todo','inProgress','completed','assigned','unassigned'];

function logisticsFixture(){
 const state=emptyState(),created='2026-11-16T10:00:00.000Z';
 state.campaigns.push({id:'autre-campagne',nom:'Autre campagne fictive',annee:2026,description:'Recette isolée.'});
 state.team=[{id:'groupe-logistique',campaignId:'demo',name:'Groupe logistique de recette',commune:CUBZAC,volunteer:'volontaire-fictif'}];
 const mission=(id,title,commune,status,more={})=>({id,campaignId:'demo',title,type:'Distribution',commune,status,assignee:'',volunteers:[],created,...more});
 state.missions=[
  mission('mission-multi',MULTI_TITLE,CUBZAC,'À faire',{zoneKind:'commune',zoneCommunes:[CUBZAC,SAINT_ANDRE,SAINT_ANDRE],assignee:'Groupe logistique de recette',volunteers:['volontaire-fictif']}),
  mission('mission-progress','Préparation du matériel',SAINT_ANDRE,'En cours',{volunteers:['volontaire-fictif']}),
  mission('mission-completed','Inventaire terminé',SAINT_ANDRE,'Terminée'),
  mission('mission-bourg','Vérification logistique à Bourg','Bourg','À faire'),
  mission('mission-autre-campagne','Action d’une autre campagne',SAINT_ANDRE,'Terminée',{campaignId:'autre-campagne',assignee:'Groupe logistique de recette'}),
 ];
 return state;
}
async function prepareLogistics(page){
 await page.addInitScript(({key,state})=>{
  if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(state));
 },{key:APP_KEY,state:logisticsFixture()});
 await page.goto('/');
}
async function openActions(page){
 await page.locator('.sidebar [data-nav=actions]:visible, .mobile-nav [data-nav=actions]:visible').first().click();
 await expect(page.getByRole('button',{name:'Suivi par commune',exact:true})).toBeVisible();
}
async function openCoverage(page){
 await openActions(page);
 await page.getByRole('button',{name:'Suivi par commune',exact:true}).click();
 await expect(page.locator('#logistics-coverage')).toBeVisible();
}
async function expectCounts(page,code,values){
 const row=page.locator(`#logistics-coverage-table [data-coverage-commune="${code}"]`);
 await expect(row).toHaveCount(1);
 for(const key of METRICS)await expect(row.locator(`[data-coverage-count="${key}"]`)).toHaveText(String(values[key]));
}
async function expectDistinct(page,count){
 await expect(page.locator('#coverage-summary')).toContainText(new RegExp(`\\b${count}\\s+missions?\\s+distinctes?\\b`));
}
async function captureCoverage(page,testInfo,label){
 mkdirSync('test-results/captures',{recursive:true});
 const body=await page.screenshot({path:`test-results/captures/${label}-${testInfo.project.name}.png`,fullPage:true});
 await testInfo.attach(label,{body,contentType:'image/png'});
}
const saintAndreCounts={total:3,todo:1,inProgress:1,completed:1,assigned:2,unassigned:0};
const zeroCounts={total:0,todo:0,inProgress:0,completed:0,assigned:0,unassigned:0};

test('suivi logistique par commune : missions distinctes, affectations et communes sans mission',async({page},testInfo)=>{
 test.setTimeout(60000);
 await prepareLogistics(page);await openCoverage(page);
 const rows=page.locator('#logistics-coverage-table [data-coverage-commune]');
 await expect(rows).toHaveCount(87);
 await expectDistinct(page,4);
 await expectCounts(page,'33366',saintAndreCounts);
 await expectCounts(page,'33143',{total:1,todo:1,inProgress:0,completed:0,assigned:1,unassigned:0});
 await expectCounts(page,'33067',{total:1,todo:1,inProgress:0,completed:0,assigned:0,unassigned:1});
 await expectCounts(page,'33001',zeroCounts);
 await expect(page.locator('#logistics-coverage')).toContainText('Disponibilités des équipes : non renseignées.');
 const names=await page.locator('#logistics-coverage-table [data-coverage-commune] > :first-child').evaluateAll(cells=>cells.map(cell=>{
  const label=cell.cloneNode(true);for(const hint of label.querySelectorAll('small'))hint.remove();return label.textContent.trim();
 }));
 expect(names).toEqual([...names].sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base'})));

 // La recherche porte sur les missions ; les communes sans résultat restent présentes.
 await page.locator('#filter-query').fill('Préparation du matériel');
 await expect(rows).toHaveCount(87);
 await expectDistinct(page,1);
 await expectCounts(page,'33366',{total:1,todo:0,inProgress:1,completed:0,assigned:1,unassigned:0});
 await expectCounts(page,'33143',zeroCounts);
 await expectCounts(page,'33001',zeroCounts);
 await page.locator('#filter-query').fill('');
 await expectDistinct(page,4);await expectCounts(page,'33366',saintAndreCounts);
 await captureCoverage(page,testInfo,'suivi-logistique-communes-et-affectations');
});

test('suivi logistique actualisé après modification, filtre communal et sauvegarde',async({page},testInfo)=>{
 test.setTimeout(60000);
 await prepareLogistics(page);await openActions(page);
 const original=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).missions.find(mission=>mission.id==='mission-multi'),APP_KEY);
 await page.locator('[data-edit-mission="mission-multi"]').click();
 await page.locator('#mission-form [name=status]').selectOption('Terminée');
 await page.locator('#mission-form button[type=submit]').click();
 await expect(page.locator('#mission-form')).toHaveCount(0);
 await expect(page.locator('.mission-line').filter({hasText:MULTI_TITLE}).locator('.status-done')).toHaveText('Terminée');
 await page.getByRole('button',{name:'Suivi par commune',exact:true}).click();
 await expectDistinct(page,4);
 const completedCounts={total:3,todo:0,inProgress:1,completed:2,assigned:1,unassigned:0};
 await expectCounts(page,'33366',completedCounts);
 await expectCounts(page,'33143',{total:1,todo:0,inProgress:0,completed:1,assigned:0,unassigned:0});

 // La mission est rattachée à Cubzac en premier, mais couvre aussi Saint-André.
 await page.locator('#filter-commune').selectOption(SAINT_ANDRE);
 await expect(page.locator('#logistics-coverage-table [data-coverage-commune]')).toHaveCount(1);
 await expectDistinct(page,3);await expectCounts(page,'33366',completedCounts);
 await page.reload();await openCoverage(page);
 await expect(page.locator('#filter-commune')).toHaveValue(SAINT_ANDRE);
 await expect(page.locator('#logistics-coverage-table [data-coverage-commune]')).toHaveCount(1);
 await expectDistinct(page,3);await expectCounts(page,'33366',completedCounts);
 await expect(page.locator('#logistics-coverage')).toContainText('Disponibilités des équipes : non renseignées.');

 const beforeExport=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),APP_KEY);
 const edited=beforeExport.missions.find(mission=>mission.id==='mission-multi');
 expect(edited.status).toBe('Terminée');
 expect(edited.commune).toBe(CUBZAC);
 expect(edited.zoneCommunes).toEqual(original.zoneCommunes);
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('button[data-action=backup]:visible').first().click()]);
 const backup=JSON.parse(await readFile(await download.path(),'utf8'));
 expect(backup.format).toBe('democraction-demo-backup-v1');
 for(const key of ['version','campaigns','current','missions','results','team','archives','drafts'])expect(backup.application[key]).toEqual(beforeExport[key]);
 expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),APP_KEY)).toEqual(beforeExport);
 await captureCoverage(page,testInfo,'suivi-logistique-statut-filtre-et-sauvegarde');

 await page.locator('button[data-nav=carte]:visible').first().click();
 await expect(page.locator('#map-layer')).toBeVisible();
 await expect(page.locator('#map-layer option[value=priority],.priority-controls')).toHaveCount(0);
});
