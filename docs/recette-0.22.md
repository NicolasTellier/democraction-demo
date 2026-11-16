# DemocrAction V0.22 — cartes descriptives et préférences compatibles

16 novembre 2026. Cette version retire le classement de priorité d'action calculé à partir de la participation électorale et d'indicateurs sociaux. Les cartes de participation, d'abstention et d'indicateurs Insee restent descriptives ; la création d'une action conserve la sélection géographique.

## Compatibilité

Les anciennes préférences et sauvegardes qui sélectionnaient la couche `priority` reviennent sur `participation`. Les trois réglages de pondération retirés ne sont plus enregistrés ni exportés. Commune, recherche, sélection cartographique, autres couches valides, campagnes, actions, résultats, groupes, archives, brouillons et secteurs sont conservés. Aucun schéma de stockage n'est modifié.

La version affichée est V0.22 ; références de script/style et cache de la démonstration renouvelés pour servir la nouvelle interface.

## Recette de source

Source publique préparée dans le dépôt principal au [commit `b7b9da9`](https://github.com/NicolasTellier/democraction/commit/b7b9da94a44014773e103bb5155f93336d40a844), [CI 43880866016](https://github.com/NicolasTellier/democraction/actions/runs/43880866016).

Deux scénarios dans `tests/browser/descriptive-map.spec.js`, sur les quatre formats du projet : migration des préférences et exports, couche revenu médian persistante avec source/unité, action créée depuis une commune, restauration complète d'une ancienne sauvegarde JSON et conservation après réouverture. Captures attachées à chaque format.

Recette de source : **28 tests Node et 81 parcours navigateur publics réussis**, 15 ignorés. La publication publique est contrôlée par le [workflow Pages du dépôt](https://github.com/NicolasTellier/democraction-demo/actions) pour le commit correspondant.

## Portée

Démonstration publique uniquement : données territoriales publiques et objets fictifs, stockage local. Le CRM serveur privé n'est pas déployé sur Pages. Cette version ne valide pas un iPhone physique ni la synchronisation privée HTTPS. Le parcours complet de planification par couverture, missions et disponibilités reste à développer séparément (ANA-LOG-02) ; le critère52 conserve son statut complet Non testé.
