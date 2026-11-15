# DemocrAction 0.16 — abstention et statuts des actions

Lot de correction de la V1.0 après audit des 36 critères. La V0.15 des voies et l’audit BAN restent en place.

## Fonctions et méthode

- La carte propose une couche **Abstention électorale** avec choix du scrutin et du tour. Pour chaque commune disposant d’effectifs valides : `(inscrits − votants) / inscrits × 100`. La fiche affiche le taux, la source et le scrutin. Le total du territoire additionne les inscrits et les votants avant de calculer le taux ; une moyenne simple des taux communaux serait erronée.
- Les actions conservent un statut **À faire**, **En cours** ou **Terminée** et leur périmètre. Un parcours navigateur vérifie la liste, la couleur du contour sur la carte et la persistance après rechargement.
- Les résultats restent agrégés par commune ; aucune conclusion sur le comportement d’une personne n’est déduite.

## Recette

| Scénario | État | Preuve |
|---|---|---|
| Formule, données municipales 2026 et total pondéré | Réussi en local | `npm test`, `tests/abstention.test.js` : 14 tests Node réussis. |
| Couche, légende, scrutin, fiche, persistance sur quatre formats | À vérifier en CI | `tests/browser/abstention.spec.js`. |
| Statut d’action, couleur du périmètre et restauration | À vérifier en CI | `tests/browser/action-status.spec.js`. |
| Site public et paquet privé | À vérifier après publication | Lien de CI et commit à renseigner. |

Les géométries des bureaux de vote ne sont pas supposées. La démo demeure locale, sans synchronisation multiappareil ni CRM privé de production.
