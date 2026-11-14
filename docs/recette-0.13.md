# DemocrAction 0.13 — import de contours de bureaux

Lot 1 du cahier des charges V1.1, critère 15. Cette version complète l'identité des 23 bureaux fournis dans la version 0.12. Aucun périmètre nouveau n'est publié par défaut.

## Fonction livrée

Dans **Carte → Bureau de vote → Référentiel des bureaux**, sélectionner la commune pour un KML/KMZ, renseigner la source déclarée, puis charger le fichier. Le nom de chaque repère KML doit inclure son numéro (« Bureau 1 », « BV 2 »). Le GeoJSON garde ses identifiants explicites et ses codes INSEE. Un KMZ doit contenir un unique KML. Seuls les polygones de bureaux sont acceptés ; les lignes, fichiers malformés, géométries croisées, doublons dans un fichier et communes incohérentes sont refusés avant enregistrement.

La fiche affiche l'origine locale, la source déclarée, la date d'import et le statut **À confirmer**. La géométrie est conservée dans le navigateur et rechargée après fermeture. Un second fichier ajoute ses bureaux ; à identifiant identique, il remplace le contour local précédent. L'import n'atteste ni le caractère officiel du périmètre ni la signification des 23 effectifs communiqués.

## Vérifications et limites

| Scénario | Résultat | Preuve |
|---|---|---|
| KMZ ZIP Deflate : extraction du KML, taille et intégrité CRC | Réussi en local | `npm test` : fixture KMZ créée indépendamment avec Python `zipfile`, modification d'octet rejetée. |
| GeoJSON : polygone valide, provenance, code commune ; ligne et commune incohérente rejetées | Réussi en local | Tests Node `tests/bureau-import.test.js` ; 10 tests Node réussis au total. |
| KML et KMZ dans un navigateur, fiche, contour, persistance ; GeoJSON cumulatif et ligne refusée | Réussi | [CI publique 43630102136](https://github.com/NicolasTellier/democraction-demo/actions/runs/43630102136) : 40 parcours Playwright réussis, 4 ignorés, quatre formats. [Captures de CI](https://github.com/NicolasTellier/democraction-demo/actions/runs/43630102136/artifacts/14127084618). |
| Site publié | Réussi | Code `5d0c64f28bcf8bba0def780edfe37bd3eb19f8ca`, CI et GitHub Pages verts. Ouverture directe de la [démo V0.13](https://nicolastellier.github.io/democraction-demo/) : import d'un KMZ fictif pour le bureau 33366-1, polygone translucide, source et statut « À confirmer » visibles. [Capture de la recette](captures/bureau-import-0.13.jpg). |
| Miroir privé | En cours | Le code, les tests et cette recette seront copiés dans le dépôt privé, puis vérifiés par ses CI. |

Le service ne récupère pas automatiquement le My Maps cité pour Saint-André-de-Cubzac : son export vérifiable reste à fournir ou à trouver. Les données sont stockées localement et ne sont pas synchronisées entre appareils. L'import n'est pas un registre d'habilitation officiel. Le prochain travail du lot 1 est l'inventaire et le préchargement progressif des voies des 87 communes avec signalement des lacunes.

Références techniques : [format des polygones KML](https://developers.google.com/kml/documentation/kmlreference), [archives KMZ](https://developers.google.com/kml/documentation/kmzarchives), [décompression navigateur](https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream/DecompressionStream).
