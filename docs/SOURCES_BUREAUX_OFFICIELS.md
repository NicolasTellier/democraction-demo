# Résultats officiels par bureau — périmètre de la recette

Le fichier `data/resultats-bureaux-officiels-2024.json` contient uniquement des résultats agrégés du ministère de l’Intérieur. Il est produit par `scripts/extract-official-bureaux.py`, à partir des classeurs XLSX définitifs téléchargés depuis les deux ressources indiquées dans les métadonnées du JSON. Les classeurs volumineux ne sont pas ajoutés au dépôt ; le script vérifie leurs empreintes SHA-256 avant extraction. Les ressources législatives 2024 sont publiées sous Licence Ouverte 2.0.

| Scrutin | Source | Correspondance avec les 23 identifiants fournis |
|---|---|---:|
| Législatives 2024, premier tour, 30 juin | [Jeu de données du ministère](https://www.data.gouv.fr/datasets/elections-legislatives-des-30-juin-et-7-juillet-2024-resultats-definitifs-du-1er-tour) | 22/23 |
| Législatives 2024, second tour, 7 juillet | [Jeu de données du ministère](https://www.data.gouv.fr/datasets/elections-legislatives-des-30-juin-et-7-juillet-2024-resultats-definitifs-du-2nd-tour) | 0/23 : aucune ligne pour les huit communes cibles |

La correspondance utilise ensemble le code INSEE de la commune et le numéro du bureau. Le classeur T1 2024 ne compte qu’un bureau à Cavignac (`33114-1`) ; `33114-2` n’y figure pas. Le référentiel fourni par le propriétaire comporte deux bureaux à Cavignac, sans millésime confirmé. Même pour `33114-1`, la stabilité de son périmètre géographique entre 2024 et le référentiel fourni reste à vérifier. Cette réserve vaut pour tous les bureaux : l’identité numérique ne prouve pas des contours identiques entre scrutins.

Le fichier T2 ne contient aucune ligne des huit communes du référentiel. La fiche du ministère explique que les circonscriptions pourvues au premier tour ne participent pas au second. L’application doit afficher « scrutin non tenu / aucune ligne dans la source », sans zéro de votants, pourcentage d’abstention ou valeur interpolée.

Le script contrôle l’unicité de la ligne officielle par bureau, le libellé de la commune, l’égalité `inscrits = votants + abstentions`, `votants = exprimés + blancs + nuls` et la somme des voix des candidats. Les noms des candidats et leurs nuances proviennent de la source officielle ; aucune donnée individuelle d’électeur n’est utilisée.

Les fichiers présidentiels 2022 ont été étudiés en analyse locale : 22 identifiants sur 23 correspondaient à chacun des deux tours, `33114-2` restant absent. Les fiches du ministère pour le [premier](https://www.data.gouv.fr/datasets/election-presidentielle-des-10-et-24-avril-2022-resultats-definitifs-du-1er-tour) et le [second tour](https://www.data.gouv.fr/datasets/election-presidentielle-des-10-et-24-avril-2022-resultats-definitifs-du-2nd-tour) indiquent « License Not Specified ». Les extraits 2022 ne sont donc pas ajoutés au dépôt public ; leur réutilisation reste à clarifier. Les classeurs téléchargés restent hors dépôt, dans l’espace temporaire d’analyse.

Pour reproduire l’extraction, télécharger les deux ressources XLSX 2024 vers un répertoire temporaire avec les noms de fichiers précisés dans `scripts/extract-official-bureaux.py`, puis exécuter :

```bash
python scripts/extract-official-bureaux.py --source-dir /chemin/vers/les/xlsx
node --test tests/official-bureaux.test.js
```
