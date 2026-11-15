# Carroyage Insee Filosofi 2021

## Source et extraction

- Producteur : Insee, dispositif Filosofi, données 2021 publiées en février 2026. Source et dictionnaire : <https://www.insee.fr/fr/statistiques/8735243>, pages [200 m](https://www.insee.fr/fr/statistiques/8735162) et [1 km](https://www.insee.fr/fr/statistiques/8735171).
- Flux cartographique utilisé : <https://tiles.insee.fr/filosofi_2021_carreaux.pmtiles>, publié par l'outil cartographique Insee. Les tuiles vectorielles de niveaux 10 (1 km) et 11 (200 m) couvrant l'emprise des 87 communes ont été prélevées. Le niveau inférieur à 1 km, à grande échelle, n'est pas réétiqueté comme un carreau à 1 km.
- Reproduction : `node scripts/download-insee-tiles.mjs tmp/insee-tiles` puis `/usr/bin/python3 scripts/build-insee-grid.py tmp/insee-tiles data/territoire-33-11-2026.json data/insee-grid`. Le second script requiert les modules Python GDAL/OSR. Le script de téléchargement vérifie l'empreinte de la bibliothèque PMTiles servie par l'Insee avant de l'exécuter.
- Licence des données : Licence Ouverte 2.0. Les fichiers dérivés ne contiennent aucun nom ni aucune adresse. Le manifeste conserve la source, le millésime et les effectifs de contrôle.

## Contrôles et affichage

L'extrait compte **9 500 carreaux distincts de 200 m** et **1 179 carreaux distincts de 1 km** qui touchent au moins l'une des 87 communes. Les carreaux traversant plusieurs communes sont conservés dans leurs fichiers respectifs, avec un identifiant Insee unique. Les géométries sont reconstruites à partir de cet identifiant dans la projection officielle EPSG:3035 et transformées en WGS84 ; la liste des communes associées provient de l'attribut `lcog_geo` du flux officiel.

Les 87 fichiers sont découpés par commune ; chacun contient les deux résolutions. L'application ne charge qu'une commune à la fois, puis affiche les carreaux au zoom 9 (1 km) ou 12 (200 m). Aucune donnée carroyée n'est enregistrée dans le stockage du navigateur. Le champ `OBS_STATUS` distingue les valeurs diffusées (`A`) de celles imputées (`I`) pour respecter le secret statistique ; un statut absent reste indéterminé. Dans l'interface, les carreaux imputés sont dessinés en pointillés et leur effectif n'est pas montré dans la fiche.

La variable `ind` est le **nombre d'individus au sens fiscal**, qui diffère de la population municipale recensée. Les valeurs au carreau sont des données statistiques agrégées, sans lien avec un point d'adresse, une inscription ou une personne. L'Insee déconseille l'interprétation isolée de petits carreaux ruraux et la comparaison directe de millésimes dont les concepts ou le géocodage diffèrent. La couche est réservée à la lecture descriptive : un clic sur le carreau ne crée aucun contact, mission ou ciblage nominatif.

## État de la recette

Les tests Node contrôlent les deux résolutions pour les 87 codes communaux, les effectifs distincts, les géométries et l'imputation. Le parcours navigateur desktop/mobile vérifie le rendu, le chargement différé et la persistance du choix de résolution. Il doit être exécuté dans la CI Chromium avant de déclarer les critères 16 et 17 réussis.
