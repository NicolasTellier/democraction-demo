# V0.24 — comparaisons descriptives enregistrées

Validation du 19 novembre 2026. Source testée : `f9be03390119d8ada61b0d302924fa2f5f77c166`, [CI navigateur et paquet](https://github.com/NicolasTellier/democraction/actions/runs/44487051032).

## Comportement livré

- Enregistrer jusqu'à huit vues de comparaison, avec deux à cinq communes et deux scrutins de même type et même tour.
- Retrouver les paramètres après rechargement, ouvrir une vue et la supprimer sans effacer les préférences actives.
- Conserver les métadonnées publiques de source et la date d'enregistrement ; refuser les références devenues indisponibles.
- Afficher « — » pour un effectif manquant ; préserver un zéro explicitement fourni. Deux tests supplémentaires couvrent cette distinction.

## Preuves

- 43 tests Node de démonstration réussis, dont neuf ciblés sur les comparaisons et leurs vues.
- 97 parcours publics réussis, 19 ignorés ; recette privée de non-régression : 111 réussis, 1 ignoré. Tests sur Chromium, formats ordinateur et mobile émulé ; aucune validation sur iPhone physique.
- Parcours d'enregistrement, rechargement, rappel, source, retrait et second rechargement dans `tests/browser/election-history.spec.js` ; captures `comparison-saved-desktop.png` et `comparison-saved-iphone.png` à contrôler dans l’artefact Pages. La suite privée nettoie actuellement le dossier de sortie public avant son propre démarrage ; ses captures ne remplacent pas celles de ce parcours.
- Paquet statique contrôlé : 218 fichiers autorisés ; aucune donnée privée ni test privé publié.

## Limites

Les vues sont locales au navigateur, sans synchronisation entre appareils et hors sauvegarde générale. Elles conservent des paramètres, pas un instantané des chiffres : les résultats sont recalculés sur les données courantes à la réouverture. La provenance mémorisée ne garantit donc pas une reproduction historique après actualisation de source. Ce lot n'étend pas la couverture des scrutins ni des bureaux et ne permet aucune déduction de vote individuel.

La validation et le déploiement Pages de cette publication sont à contrôler sur son commit propre ; la CI de source ne remplace pas cette vérification.
