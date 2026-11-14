# DemocrAction 0.12 — référentiel des bureaux fournis

Version source : commit public `1735263af023aac01968a6fde1f0a30c4d1f847a`. Source du cahier des charges : V1.1 transmis le 14 novembre 2026.

## Livraison vérifiable

Dans **Carte → Zone à surligner → Bureau de vote**, les 23 enregistrements fournis apparaissent par commune : Bourg (2), Cubzac-les-Ponts (2), Pugnac (2), Coutras (7), Saint-Denis-de-Pile (4), Peujard (2), Saint-Savin (2), Cavignac (2). Chaque fiche indique un identifiant stable `code INSEE-numéro`, la valeur fournie et la qualification « effectif communiqué, nature et millésime à vérifier ».

Si le contour d'un bureau manque, l'interface affiche **Géométrie absente**, surligne uniquement sa commune et refuse de créer une action présentée comme localisée au bureau. Un import GeoJSON local peut associer un périmètre par identifiant ; l'import ne lui confère pas le statut officiel. Les bureaux non fournis restent absents du catalogue, sans extrapolation.

## Vérifications

| Scénario | Résultat | Environnement et preuve |
|---|---|---|
| Les 23 valeurs et huit codes INSEE correspondent au document, sans géométrie inventée | Réussi | `npm run check && npm test` : 8 tests Node réussis dans l'espace de travail, dont deux tests du catalogue. |
| Bourg, bureau 1 : fiche 875, statut incertain et commune parente surlignée ; Coutras, bureau 7 : 995 | Réussi | [GitHub Actions, run 43627468930](https://github.com/NicolasTellier/democraction-demo/actions/runs/43627468930) : 28 parcours Playwright réussis, 4 ignorés, en quatre formats. Le site publié a aussi été ouvert le 14 novembre 2026. |
| Un contour de bureau importé reste sélectionnable | Réussi | Même CI, parcours Playwright `tests/browser/p0.spec.js`, identifiant fictif `B-TEST`. |
| Recette locale Playwright | Bloquée dans cet environnement | Chromium ne peut créer son socket de profil (`Operation not permitted`). La chaîne GitHub Actions exécute Playwright sur Ubuntu ; aucune réussite locale n'est revendiquée. |

Capture de la version publiée : [Bourg, bureau 1, commune en surbrillance et fiche qualifiée](captures/bureau-bourg-0.12.jpg). La capture montre le contour **communal** ; le bureau n'a pas de géométrie. La recette navigateur de cette version a été exécutée sur ordinateur, portable, iPhone simulé et Android simulé dans la CI ; une capture mobile dédiée reste à produire.

## Limites et suite

- Les chiffres fournis ne sont pas assimilés à des inscrits, votants, résultats ou électeurs : leur sens et leur date sont inconnus.
- Aucun contour officiel des bureaux de Saint-André-de-Cubzac n'a encore été obtenu ; la carte externe citée dans le cahier des charges doit être contrôlée avant import.
- L'import accepte pour l'instant le GeoJSON et le stocke sur l'appareil courant ; KML/KMZ, validation de provenance et partage serveur restent à développer.
- Le reste des 36 critères V1.1 doit être vérifié lot par lot. La démo statique ne synchronise pas les appareils et ne reçoit pas de données personnelles réelles.
