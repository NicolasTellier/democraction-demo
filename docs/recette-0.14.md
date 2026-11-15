# DemocrAction 0.14 — voies consultables et cadrage de la carte

Lot 1, critère 25 en cours ; correction du zoom demandé au lot 2. Cette livraison ne déclare pas les 87 communes géométriquement couvertes.

## Parcours disponible

Dans **Carte → Couverture des voies**, le compteur part des 303 voies géométriques préchargées à Saint-André-de-Cubzac. Rechercher ou sélectionner une autre commune charge ses lignes IGN, puis les conserve dans le navigateur avec date, source et nombre d'objets écartés. Le bouton **Précharger les 5 prochaines communes** interroge au plus cinq communes à la suite, avec arrêt possible et reprise depuis l'inventaire local. Une erreur interrompt le lot au premier échec ; les communes déjà enregistrées restent utilisables. Les adresses BAN demeurent chargées séparément à la demande.

Le relevé provient de la couche IGN BD TOPO *voie nommée*. Il ne suffit pas à garantir l'exhaustivité des voies, chemins et lieux-dits d'une commune ; le rapprochement BAN/BAL reste à faire. Le cache IndexedDB est propre à l'appareil et se réactualise après 30 jours lorsque le service est disponible. Il ne synchronise aucune géométrie entre appareils. Après ouverture d'une fiche ou changement d'indicateur, la carte garde le centre et le niveau de zoom manipulés par l'utilisateur tant que la sélection est la même.

## Preuves

| Scénario | État | Preuve |
|---|---|---|
| Inventaire des 87 codes, cache frais ou ancien et objets écartés | Réussi en local | `npm run check && npm test`, test `tests/road-cache.test.js` ; 11 tests Node réussis. |
| Une commune chargée, rechargement sans nouveau WFS, préchargement de cinq communes, conservation du zoom | Réussi en CI | [CI publique 43698474025](https://github.com/NicolasTellier/democraction-demo/actions/runs/43698474025) : 48 parcours réussis, 4 ignorés, quatre formats. [Captures ordinateur et mobile](https://github.com/NicolasTellier/democraction-demo/actions/runs/43698474025/artifacts/14154888208), avec une rue fictive de recette. Le navigateur local du conteneur refuse le lancement de Chromium (`socket() failed: Operation not permitted`). |
| Démo GitHub Pages | Réussi | Code `1ead2541e1fe5b12fe1c428baeecc907b99926ed` ; CI et déploiement verts. Sur le [site public](https://nicolastellier.github.io/democraction-demo/), la carte affiche V0.14, le compteur initial 1/87, les 303 voies de Saint-André et sa surbrillance communale. |
| Miroir privé | En attente | Branche `codex/voies-v014` ; vérifier le paquet après intégration. |

## Restant du critère 25

Constituer et vérifier un paquet territorial des 87 communes à partir des sources IGN, BAN et BAL, inventorier les voies manquantes et lieux-dits, puis établir des mises à jour différentielles. Le WFS IGN n'était pas joignable depuis l'environnement de développement le 15 novembre 2026 ; aucun total non vérifié n'est annoncé. Les tests de parcours utilisent une réponse WFS fictive et ne prouvent pas la disponibilité du service réel pour chaque commune.
