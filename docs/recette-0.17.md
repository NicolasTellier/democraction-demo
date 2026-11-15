# DemocrAction 0.17 — intitulés des scrutins

Lot 7 du cahier V1.2, critère 49. Le paquet cartographique V0.15 et la couche abstention V0.16 sont conservés.

Les sept codes historiques CANT, DPMT, EURO, LEGI, MUNI, PRES et REGI s'affichent en toutes lettres dans le filtre, les cartes, les graphiques et les tableaux. Les codes et les millésimes restent dans les données et dans les valeurs de filtre. Les cantonales de 2008 et les départementales postérieures sont distinguées. Un code inconnu reste identifiable comme « Autre scrutin » et un intitulé libre importé est conservé.

## Recette avant publication

| Scénario | Résultat | Preuve |
|---|---|---|
| Intégrité des 87 fichiers de voies et syntaxe JS | Réussi localement | `npm run check` : 87 communes, 6 658 géométries, aucun identifiant dupliqué. |
| Correspondance des sept codes, conservation de l'origine et rendu du filtre/graphique/tableau | Réussi localement | `npm test` : 16 tests Node réussis, dont `tests/election-labels.test.js`. |
| Quatre formats navigateur, couche abstention et sélecteur | Non testé ici | Chromium local bloqué par `socket() failed: Operation not permitted`; exécuter `npm run test:e2e` dans la CI du déploiement. |
| Site public et cache PWA | Non testé ici | À vérifier après fusion et publication du commit. |

Le changement ne crée aucun fichier personnel et n'ajoute aucun service payant.
