import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateOfficialBureauResults,officialBureauResultHtml} from '../app/official-bureaux.js';

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
