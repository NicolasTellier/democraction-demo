import test from 'node:test';import assert from 'node:assert/strict';
import {syntheticListFixture,viewSyntheticListComparison} from '../app/synthetic-list-view.js';
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
