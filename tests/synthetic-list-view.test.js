import test from 'node:test';import assert from 'node:assert/strict';
import {syntheticListFixture,viewSyntheticListComparison,syntheticListComparisonCsv,SYNTHETIC_LIST_CSV_FIELDS} from '../app/synthetic-list-view.js';
const state={codes:['33001','33002','33003'],firstId:'a',secondId:'b',listAId:'a-1',listBId:'b-2',metric:'share'};
test('vue fictive : points, dénominateur nul, absence et sources distinctes',()=>{
 const html=viewSyntheticListComparison(state);
 assert.match(html,/\+15/);assert.match(html,/Aucun exprimé/);assert.match(html,/Résultat ou liste indisponible/);
 assert.match(html,/1\/3 comparaisons disponibles/);assert.match(html,/Jeu de démonstration fictif B/);
});
test('vue fictive : choix requis et contenu échappé',()=>{
 assert.match(viewSyntheticListComparison({...state,listAId:''}),/Choisissez explicitement/);
 assert.match(viewSyntheticListComparison({...state,codes:[]}),/Sélectionnez au moins/);
 const data=syntheticListFixture();data.results[0].listes[0].label='<img src=x>';
 assert.doesNotMatch(viewSyntheticListComparison(state,data),/<img/);
});

const records=csv=>csv.replace(/^\uFEFF/,'').split('\r\n').slice(1).map(line=>Object.fromEntries(line.split(';').map((value,i)=>[SYNTHETIC_LIST_CSV_FIELDS[i],value])));
test('CSV fictif : deux provenances, mesure, valeurs et absence vides distinctes du zéro',()=>{
 const csv=syntheticListComparisonCsv(state),rows=records(csv);
 assert.ok(csv.startsWith('\uFEFFsynthetic;schema_version;code_insee;'));
 assert.equal(rows.length,3);assert.equal(rows[0].synthetic,'true');
 assert.equal(rows[0].liste_a,'a-1');assert.equal(rows[0].liste_b,'b-2');
 assert.equal(rows[0].ecart_b_moins_a,'15');assert.equal(rows[0].mesure,'share');
 assert.equal(rows[0].date_scrutin_a,'2020-03-15');assert.equal(rows[0].date_source_b,'2026-11-20');
 assert.equal(rows[1].voix_a,'0');assert.equal(rows[1].part_exprimes_a,'');
 assert.equal(rows[1].statut_part_a,'zero-denominator');assert.equal(rows[1].ecart_b_moins_a,'');
 assert.equal(rows[2].voix_b,'');assert.equal(rows[2].statut_b,'missing-result');
});
test('CSV fictif : sélection dédupliquée, inversion et voix sans arrondi',()=>{
 const rows=records(syntheticListComparisonCsv({...state,codes:['33001','33001'],firstId:'b',secondId:'a',listAId:'b-2',listBId:'a-1',metric:'votes'}));
 assert.equal(rows.length,1);assert.equal(rows[0].valeur_a,'120');assert.equal(rows[0].valeur_b,'50');
 assert.match(rows[0].ecart_b_moins_a,/-70/);assert.equal(rows[0].communes_selectionnees,'1');
});
test('CSV fictif : précision conservée et échappement de la source par le sérialiseur existant',()=>{
 const data=syntheticListFixture();data.results[0].exprimes=3;
 data.results[0].listes[0].votes=1;data.results[0].listes[1].votes=2;
 data.ballots[0].source.label='=Source; "fictive"';
 const csv=syntheticListComparisonCsv({...state,codes:['33001']},data);
 assert.ok(csv.includes(String(1/3*100)));assert.match(csv,/""fictive""/);
 assert.ok(csv.includes("'=Source"));assert.doesNotMatch(csv,/;=Source/);
});
test('export absent avant les choix ou sans commune ; contrat invalide refusé',()=>{
 for(const s of [{...state,listAId:''},{...state,codes:[]}]){
  assert.doesNotMatch(viewSyntheticListComparison(s),/data-list-export/);
  assert.throws(()=>syntheticListComparisonCsv(s));
 }
});
