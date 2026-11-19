import {serializeCsv} from '../app/core.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateOfficialBureauResults,compareOfficialBureauResults,officialBureauResultHtml,officialBureauComparisonHtml,officialBureauComparisonRecords,BUREAU_COMPARISON_FIELDS} from '../app/official-bureaux.js';

const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const data=read('../data/resultats-bureaux-officiels-2024.json');
const catalog=read('../data/bureaux-referentiel-23.json').stations;

test('résultats officiels 2024 T1 validés pour 22 bureaux, source et totaux intègres',()=>{
 assert.equal(validateOfficialBureauResults(data,catalog),data);
 const html=officialBureauResultHtml(data,'33067-1');
 assert.match(html,/832/);assert.match(html,/530/);assert.match(html,/Edwige DIAZ/);
 assert.match(html,/221 voix/);assert.match(html,/Ministère de l’Intérieur/);
 assert.match(html,/périmètre géographique/);
});

test('Cavignac 2 sans résultat apparié et deuxième tour sans abstention fabriquée',()=>{
 const html=officialBureauResultHtml(data,'33114-2');
 assert.match(html,/Aucun résultat officiel apparié/);
 assert.match(html,/un seul bureau/);
 assert.doesNotMatch(html,/voix par candidat/i);
 assert.match(html,/scrutin non tenu/);
 const tampered=structuredClone(data);tampered.scrutins[0].bureaux[0].votants++;
 assert.throws(()=>validateOfficialBureauResults(tampered,catalog),/invalide/);
});

test('les noms issus des données sont échappés avant insertion dans la fiche',()=>{
 const tampered=structuredClone(data);tampered.scrutins[0].bureaux[0].candidats[0].name='<img src=x onerror=alert(1)>';
 const html=officialBureauResultHtml(tampered,tampered.scrutins[0].bureaux[0].bureauId);
 assert.doesNotMatch(html,/<img/);assert.match(html,/&lt;img/);
});

test('comparaison descriptive de deux bureaux : effectifs, taux exacts, source et absence de mutation',()=>{
 const before=structuredClone(data);
 const result=compareOfficialBureauResults(validateOfficialBureauResults(data,catalog),'33067-1','33067-2');
 assert.deepEqual(result.first,{
  bureauId:'33067-1',codeInsee:'33067',numero:1,commune:'Bourg',
  inscrits:832,votants:530,abstentions:302,blancs:15,nuls:2,exprimes:513,
  participationRate:530*100/832,abstentionRate:302*100/832
 });
 assert.deepEqual(result.second,{
  bureauId:'33067-2',codeInsee:'33067',numero:2,commune:'Bourg',
  inscrits:853,votants:580,abstentions:273,blancs:12,nuls:4,exprimes:564,
  participationRate:580*100/853,abstentionRate:273*100/853
 });
 assert.equal(result.delta.participation,580*100/853-530*100/832);
 assert.equal(result.delta.abstention,273*100/853-302*100/832);
 assert.deepEqual(result.scrutin,{
  id:'legislatives-2024-t1',label:'Législatives 2024 — 1er tour',date:'2024-06-30',tour:1,
  source:{...data.scrutins[0].source}
 });
 assert.deepEqual(data,before);
});

test('un résultat de bureau absent reste absent et ne fabrique ni taux ni écart',()=>{
 const result=compareOfficialBureauResults(data,'33067-1','33114-2');
 assert.equal(result.first.inscrits,832);
 assert.equal(result.second,null);
 assert.deepEqual(result.delta,{participation:null,abstention:null});
 assert.throws(()=>compareOfficialBureauResults(data,'33067-1','33067-1'),/distincts/);
});


test('comparateur rendu : effectifs exacts, taux, couverture, source et absence explicite',()=>{
 const html=officialBureauComparisonHtml(data,'33067-1','33067-2');
 assert.match(html,/832/);assert.match(html,/853/);assert.match(html,/63,7 %/);assert.match(html,/68,0 %/);
 assert.match(html,/\+4,3 points/);assert.match(html,/-4,3 points/);assert.match(html,/22\/23/);
 assert.match(html,/2024-06-30/);assert.match(html,/data.gouv.fr/);
 assert.doesNotMatch(html,/<option value="33114-2"/);
 const missing=officialBureauComparisonHtml(data,'33114-2','33067-1');
 assert.match(missing,/aucun résultat officiel apparié/);assert.doesNotMatch(missing,/<table/);
});

test('export des bureaux : valeurs exactes, provenance, absence vide et bornes',()=>{
 const before=structuredClone(data);
 const [row]=officialBureauComparisonRecords(data,'33067-1','33067-2');
 assert.equal(row.inscrits_a,832);assert.equal(row.inscrits_b,853);
 assert.equal(row.votants_a,530);assert.equal(row.votants_b,580);
 assert.equal(row.ecart_participation_points,580*100/853-530*100/832);
 assert.equal(row.date_scrutin,'2024-06-30');assert.equal(row.source,data.scrutins[0].source.dataset);
 assert.equal(row.empreinte_source,data.scrutins[0].source.sha256);
 const csv=serializeCsv([row],BUREAU_COMPARISON_FIELDS);
 assert.ok(csv.startsWith('\uFEFFscrutin;date_scrutin;tour;bureau_a'));
 assert.ok(csv.includes(';832;530;302;513;15;2;'));
 const [missing]=officialBureauComparisonRecords(data,'33067-1','33114-2');
 assert.equal(missing.inscrits_b,null);assert.equal(missing.ecart_participation_points,null);
 const cells=serializeCsv([missing],BUREAU_COMPARISON_FIELDS).split('\r\n')[1].split(';');
 assert.equal(cells[BUREAU_COMPARISON_FIELDS.indexOf('inscrits_b')],'');
 assert.equal(cells[BUREAU_COMPARISON_FIELDS.indexOf('ecart_participation_points')],'');
 assert.throws(()=>officialBureauComparisonRecords(data,'33067-1','inconnu'),/référentiel/);
 assert.throws(()=>officialBureauComparisonRecords(data,'33067-1','33067-1'),/distincts/);
 assert.deepEqual(data,before);
});
