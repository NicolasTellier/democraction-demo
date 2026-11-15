# DemocrAction 0.18 — historique de participation et d’abstention

Le filtre « Type de scrutin » et le filtre « Tour » pilotent une courbe chronologique agrégée. Les taux sont calculés à partir des inscrits et votants, par année et sur le périmètre territorial sélectionné. Le filtre « Année » ne masque pas les autres points de la courbe. Un tableau donne les effectifs et taux exacts ; la source, sa date de mise à jour et le nombre de communes sont visibles. Aucune comparaison n’est présentée comme un transfert individuel de voix.

## Recette locale

| Contrôle | Résultat | Preuve |
|---|---|---|
| Syntaxe JavaScript et paquet de 87 communes / 6 658 voies | Réussi | `npm run check` |
| Pondération par inscrits, rejet d’effectifs incohérents, source, tableau et intégration des filtres | Réussi | `npm test` : 19 tests Node réussis |
| Parcours navigateur ordinateur et portable | Non testé localement | Test Playwright ajouté ; Chromium local ne démarre pas (`socket() failed: Operation not permitted`). À exécuter dans la CI de publication. |
| Version servie sur GitHub Pages et cache PWA | Non testé | Vérifier après publication de la V0.18. |

Le résultat demeure descriptif à l’échelle communale. La couverture peut varier selon les années. Ce lot ne valide pas à lui seul l’ensemble du critère 50 ni les autres graphiques, les comparaisons de bureaux ou les vues sauvegardées.
