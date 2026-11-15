# Audit des voies BAN et IGN — V0.15

Cet audit rapproche les noms de voies présents dans les adresses de la Base Adresse Nationale (BAN) des lignes publiques de la couche IGN BD TOPO « voie nommée », commune par commune. Il sert à repérer des écarts à examiner ; un nom BAN sans ligne ne signifie pas qu'une rue n'existe pas. Le fichier [voies-ecarts.json](../data/voies-ecarts.json) contient des totaux par commune et au plus douze exemples de noms en écart par commune. Il ne contient aucune adresse individuelle, coordonnées d'adresse ni donnée personnelle.

## Sources et méthode

- [BAN, téléchargements publics](https://adresse.data.gouv.fr/outils/telechargements) : fichier Gironde `adresses-33.csv.gz`, actualisé chaque jour, et fichier séparé `lieux-dits-33-beta.csv.gz` pour les lieux-dits sans adresse. Les deux fichiers utilisés, leur empreinte SHA-256 et la date de réponse figurent dans les métadonnées du rapport.
- [IGN BD TOPO, voie nommée](https://geoservices.ign.fr/bdtopo) : fichiers GeoJSON listés dans `data/voies-manifest.json`. Le rapport de chaque commune distingue le nombre de lignes IGN et de noms de voie BAN.
- Le rapprochement se fait d'abord par `id_fantoir` quand il correspond à l'identifiant IGN, puis par nom normalisé (casse, accents, ponctuation). Aucun appariement approximatif n'est validé automatiquement. Les lieux-dits restent un décompte distinct ; une représentation ponctuelle BAN n'est pas transformée en tracé de route.

Le script `python scripts/audit-ban.py` télécharge chaque archive une seule fois pendant l'exécution, analyse le CSV en flux et supprime les archives temporaires. Il vérifie les 87 codes attendus et la cohérence des nombres déclarés par le manifeste. Une erreur de source ou de schéma arrête l'audit sans publier de rapport incomplet.

## Résultat du 15 novembre 2026

| Mesure | Nombre |
|---|---:|
| Communes avec un fichier de lignes IGN | 87 / 87 |
| Lignes « voie nommée » IGN | 6 658 |
| Noms de voie distincts avec adresse BAN | 6 440 |
| Adresses BAN lues pour établir les seuls agrégats | 77 947 |
| Noms de voie BAN sans ligne IGN rapprochée | 1 115 |
| Lieux-dits distincts BAN, comptés à part | 1 068 |

À Abzac, 83 des 84 noms de voie BAN ont été rapprochés d'une ligne IGN ; « Rue Henri Rozier » reste à vérifier. À Saint-André-de-Cubzac, 275 des 301 noms BAN ont été rapprochés ; 26 noms demandent examen. Le fichier `data/voies-ecarts.json` porte les agrégats des 87 communes, les deux empreintes SHA-256 des archives et leurs dates de modification (13 novembre 2026). Le nombre de communes dotées de lignes IGN ne doit pas être confondu avec l'exhaustivité de leurs voies, adresses ou lieux-dits.

## Limites à traiter

Cet audit utilise le CSV national BAN diffusé par département. Il ne compare pas indépendamment les 87 fichiers sources des Bases Adresses Locales communales, et les voies sans numéro peuvent manquer du CSV des adresses. Les lieux-dits de l'export complémentaire portent encore la mention « bêta ». Les écarts de libellé, voies nouvelles, anciens codes FANTOIR et géométries manquantes doivent être vérifiés auprès des sources communales avant de marquer le critère 25 comme entièrement réussi.
