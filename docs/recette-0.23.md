# DemocrAction V0.23 — suivi des missions par commune

16 novembre 2026. Version de démonstration, source [`cbdf4b1`](https://github.com/NicolasTellier/democraction/commit/cbdf4b1c854574fdf30399906cfe3422396de301), [recette de source 43887929167](https://github.com/NicolasTellier/democraction/actions/runs/43887929167).

Dans Actions de terrain, l'onglet **Suivi par commune** compte les missions de la campagne courante et leurs affectations renseignées. Les filtres géographiques limitent les communes ; la recherche porte sur les missions. L'ordre est alphabétique.

Une action multicommunale est comptée une fois dans chaque commune concernée et une seule fois dans la synthèse. Les rattachements répétés sont dédupliqués. À faire, En cours et Terminée sont séparés. Les colonnes d'affectation concernent les actions restantes ; une mission terminée ne devient pas une action restante sans affectation.

Disponibilités des équipes : non renseignées. Les effectifs décrivent les actions enregistrées ; la couverture physique se renseigne par compte rendu. Aucun score, résultat électoral ou indicateur social n'intervient dans le calcul.

## Recette

- Neuf tests Node sur le calcul pur : déduplication, plusieurs communes, campagne isolée, annulation/statut inconnu, identifiants, affectations, zéros et entrées gelées.
- Deux scénarios navigateur sur quatre formats : effectifs et recherche ; changement de statut, filtre communal, rechargement et sauvegarde sans mutation.
- Recette de source : **37 tests Node de démo**, **89 parcours publics réussis** (15 ignorés), **49 privés réussis** (1 ignoré) ; 82 tests serveur.
- Publication contrôlée par le [workflow Pages](https://github.com/NicolasTellier/democraction-demo/actions) correspondant au commit de cette version. Captures jointes à la recette.

Le tableau est calculé à partir des missions sauvegardées ; aucun registre n'est migré et la sauvegarde conserve le même format. Le cache public est renouvelé pour inclure le nouveau module.

Cette version ne valide pas une disponibilité réelle, un iPhone physique ou un serveur privé HTTPS. La consultation privée limitée aux missions autorisées sera traitée séparément (ANA-LOG-02b).
