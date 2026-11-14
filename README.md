# DemocrAction — démonstration cartographique

La [démonstration publique](https://nicolastellier.github.io/democraction-demo/) est un site statique GitHub Pages. Elle permet d'explorer les contours de 87 communes de Gironde, des résultats électoraux agrégés depuis 2008, des indicateurs Insee et des actions locales fictives. Elle n'est pas une base de campagne privée prête pour des données personnelles.

## Installation locale

Prérequis : Node.js 24, npm, Python 3 pour le serveur local ; Chromium pour la recette navigateur.

```bash
npm ci
npm run check
npm test
npx playwright install chromium
npm run test:e2e
python3 -m http.server 8080
```

Ouvrir `http://localhost:8080/`. Si Chromium est installé dans le système et non dans Playwright, exécuter par exemple `CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e`. Aucun identifiant, fichier `.env` ou secret n'est requis pour cette démo statique.

## Carte et données

- `data/communes-33-11.geojson` : contours communaux ; le choix d'une commune, d'un canton ou d'une intercommunalité surligne des surfaces et non des points.
- `data/voies-33366.geojson` : 303 voies nommées et géométries linéaires de Saint-André-de-Cubzac, relevées le 14 novembre 2026 auprès du [WFS IGN BD TOPO](https://data.geopf.fr/wfs/ows). Pour les autres communes, la carte interroge le WFS à la demande. Un échec réseau est affiché ; aucun tracé n'est inventé.
- Les adresses de la [Base Adresse Nationale](https://adresse.data.gouv.fr/commune/33366) sont chargées à la demande pour les rues choisies. Seuls les numéros, voies, communes et points publics sont utilisés ; aucun habitant n'est associé.
- `data/elections-2008-2026.json.gz` et `data/socio-demographie-v3.json` : données agrégées, provenance détaillée dans les métadonnées des fichiers. La priorité territoriale est un indice descriptif communal dont les poids et la méthode sont visibles dans l'interface. Il ne s'applique à aucune personne.
- `data/bureaux-referentiel-23.json` : 23 bureaux nommés dans huit communes, fournis par le propriétaire. Leurs chiffres sont des « effectifs communiqués, nature et millésime à vérifier » ; ils ne sont pas des résultats électoraux. Le menu Commune → Bureau ouvre une fiche. Sans géométrie de bureau, seule la commune est surlignée. Un GeoJSON importé localement avec l'identifiant `code INSEE-numéro` permet d'afficher un contour ; son origine et sa validation restent à confirmer. Aucun contour n'est déduit des chiffres.

La sélection de plusieurs rues est conservée dans une action avec les identifiants de voies et une géométrie `MultiLineString`. Les actions, filtres et secteurs dessinés restent dans le stockage de ce navigateur. La sauvegarde JSON inclut les actions et les secteurs ; elle exclut les contacts fictifs et les contours de bureaux importés.

## Publication

Une modification de `main` dans ce dépôt lance `.github/workflows/pages.yml`. Le workflow installe les dépendances, vérifie le JavaScript et les données, exécute les tests Node et Playwright dans quatre formats, puis construit une liste explicite de fichiers publics dans `site/` et déploie GitHub Pages. La publication échoue si un test échoue. Les nouveaux fichiers JS et GeoJSON doivent être ajoutés à cette liste et au cache `sw.js`.

Ce dépôt ne publie ni le serveur, ni un fichier de contacts, ni une clé d'accès. Les notifications mobiles et e-mails réels, les comptes, les rôles, la synchronisation entre appareils, les relances personnelles et les imports privés nécessitent une API hébergée séparément sur HTTPS. Le serveur Node/SQLite du [dépôt source privé](https://github.com/NicolasTellier/democraction) est préparatoire et non déployé. Avant de le connecter, il faut définir l'hébergement, le domaine, les sauvegardes, les droits à quatre rôles et le traitement des données ; ne pas utiliser le stockage local public pour des contacts réels. Aucun service payant n'est activé par cette publication.

Voir [recette 0.12](docs/recette-0.12.md) pour les parcours vérifiés, les limites et les étapes de déploiement privé.
