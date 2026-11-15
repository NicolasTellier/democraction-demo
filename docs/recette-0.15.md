# DemocrAction 0.15 — paquet territorial des voies

Lot 1 du cahier V1.1, critère 25 en cours. Ce relevé couvre la couche IGN BD TOPO « voie nommée » pour les 87 communes, sans prétendre couvrir tous les chemins, lieux-dits ni adresses.

## Livraison

- 87 fichiers GeoJSON compressés, un par commune, chargés uniquement lors de l’ouverture de la commune ; 6 658 géométries au total et 1,79 Mo comprimés.
- Manifeste avec code INSEE, date, nombre de lignes, source et SHA-256. Le contrôle de paquet vérifie les 87 fichiers, leur intégrité, leur nombre et l’absence de doublon d’identifiant.
- Carte : recherche et sélection des lignes de chaque commune, audit BAN agrégé dans l’inventaire, repli WFS si un fichier manque. Les adresses ponctuelles restent chargées à la demande par rue.
- Service worker : l’inventaire et le relevé de Saint-André sont disponibles hors ligne ; les autres fichiers téléchargés à la demande sont conservés dans le navigateur pour une consultation ultérieure. Les fichiers non consultés ne sont pas préchargés sur mobile.

## Vérifications

| Scénario | Résultat | Preuve |
|---|---|---|
| Intégrité des 87 fichiers et absence de doublon | Réussi en local | `npm run check` : 87 codes et 6 658 voies ; 12 tests Node réussis. |
| Source BAN et écarts de rapprochement | Réussi en local | [Audit BAN/IGN](audit-voies-0.15.md) : 6 440 noms BAN, 1 115 sans tracé rapproché ; seules des données agrégées sont publiées. |
| Ouverture d’une autre commune, recherche, zoom et repli WFS | À contrôler en CI | `tests/browser/road-cache.spec.js` sur quatre formats ; le navigateur de cet environnement ne disposait pas de Chromium. |
| Publication GitHub Pages et miroir privé | À contrôler après intégration | CI publique et CI privée à renseigner. |

## Suite du critère 25

Comparer indépendamment les sources BAL des communes, qualifier les 1 115 écarts de noms, inventorier les voies sans adresse et les lieux-dits, puis mesurer le rendu à échelle réelle et organiser les mises à jour différentielles. Aucun contour de rue ou de bureau n’est inventé pour combler une lacune. La démo ne contient aucune donnée nominative.
