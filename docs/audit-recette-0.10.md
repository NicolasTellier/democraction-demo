# DemocrAction — audit et recette de la démonstration 0.10.0

**Bilan sur 50 exigences reconstituées : 14 fonctionnelles dans leur périmètre local, 19 partielles, 8 manquantes et 9 bloquées par l'infrastructure ou une validation.** La mention « fonctionnelle » ne qualifie pas l'application entière ; elle porte uniquement sur le parcours indiqué dans la matrice. Les trois prompts d'origine n'étant pas intégralement joints, ce total décrit les exigences accessibles dans cette conversation et la pièce d'audit.

Date : 14 novembre 2026. Périmètre : demandes disponibles dans la conversation et prompt d'audit, dépôt privé `NicolasTellier/democraction`, dépôt public `NicolasTellier/democraction-demo`, site GitHub Pages. Cette matrice reconstitue les exigences accessibles ; les trois prompts originaux ne figurent pas intégralement dans la pièce jointe.

## Lecture et architecture

- **F** : parcours fonctionnel vérifié dans la démonstration locale au navigateur. **P** : partiel. **M** : manquant ou défaillant. **B** : bloqué par infrastructure ou validation absente. Une interface visible ne suffit pas à obtenir F.
- Le dépôt privé contient désormais la source de la démo dans `demo/`, le serveur Node/SQLite dans `server/`, la recette et le paquet public filtré. Le dépôt public reste le site statique. Le serveur n'est pas déployé.
- La publication automatique privée → publique est préparée dans `.github/workflows/publish-demo.yml`, mais désactivée : `DEMO_PUBLISH_ENABLED` et `DEMO_PUSH_TOKEN` ne sont pas configurés. Cette livraison a été répercutée manuellement après consolidation. La publication Pages est conditionnée à la réussite des tests Node et Playwright.
- La bibliothèque électorale contient 2 795 lignes communales pour 2008–2026 et 87 codes INSEE distincts. L'identité arithmétique inscrits = votants + abstentions et votants = exprimés + blancs + nuls est vérifiée sur toutes les lignes ; les voix individuelles des candidats des municipales plurinominales 2014/2020 ne se somment pas aux bulletins exprimés, ce qui ne doit pas être présenté comme une anomalie de totalisation.
- Les 87 contours sont des polygones locaux, joints au référentiel sur le code INSEE. Leaflet 1.9.4 et ses styles sont servis localement sous licence BSD-2-Clause. Les tuiles IGN et la police Google restent externes ; le fond de carte n'est pas garanti hors ligne. Les bureaux ne disposent pas de périmètre officiel dans le paquet public : import GeoJSON local possible, sans frontière inventée.

## Matrice de conformité

| ID | Module | Exigence initiale | État réel | Anomalie | Cause | Correction | Priorité | Test de validation | Preuve |
|---|---|---|---|---|---|---|---|---|---|
| G01 | Carte | 87 contours communaux | F | Ancienne dépendance aux centres externes | Attente API avant rendu | Chargement GeoJSON local indépendant | P0 | T01 | Navigateur, CI |
| G02 | Carte | Commune sélectionnée comme surface | F | Ancien point unique | Affichage centré sur marqueur | Polygone translucide et fiche INSEE | P0 | T02 | Navigateur |
| G03 | Carte | Plusieurs communes | P | Sélection unique initiale | État mono-commune | Maj/Ctrl-clic et géométrie multiple | P0 | T02 | Code ; parcours multi-clic non vérifié dans la recette finale |
| G04 | Carte | EPCI et canton en surface | F | Fiche agrégée absente auparavant | Sélection limitée à la commune | Union des polygones, fiche communale additionnée avec contrôle des manquants | P0 | T02 | Playwright et navigateur : 16 communes Grand Cubzaguais, 24 canton Nord-Gironde |
| G05 | Carte | Bureaux de vote officiels | P | Aucun polygone fourni | Source locale indisponible | Import GeoJSON validé, provenance à contrôler | P0 | T06/C06 | Import d'essai validé sur quatre formats ; aucune strate officielle fournie |
| G06 | Carte | Dessiner et éditer un secteur | F | Boutons créaient un sommet parasite | Propagation des clics Leaflet | Désactivation de propagation, sommets glissables, insertion/suppression | P0 | T06 | Playwright, CI |
| G07 | Carte | Enregistrer, retrouver, exporter un secteur | F | Seulement local à un navigateur | localStorage | Enregistrement, édition, suppression, export GeoJSON local | P0 | T06/T11 | Playwright, CI |
| G08 | Carte | Plusieurs voies sélectionnables | P | Points BAN et catalogue limité | Pas de tracés routiers | Catalogue Saint-André, sélection multiple ; tracés à intégrer | P0 | T05 | Navigateur : 2 rues conservées |
| G09 | Carte | Adresses et fiches liées | M | Aucune couche adresse complète | Référentiel adresse absent | Référentiel et API privée sécurisée | P1 | T05 | Pas de parcours |
| G10 | Carte | Légende, unités, sources, valeurs absentes | F | Seuils génériques initiaux | Même classification pour toute mesure | Pourcentages fixes, quantiles pour valeurs, gris manquant | P0 | T03 | Playwright, CI |
| G11 | Carte | Carte d'écarts électoraux | P | Deux cartes et tableau, pas de troisième carte d'écarts | Calcul affiché uniquement en tableau | Ajouter couche divergente d'écarts | P1 | T04 | Navigateur, CI |
| D01 | Data | Scrutins publics depuis 2008 | P | Couverture hétérogène par tour/commune | Sources historiques inégales | Exposer les lacunes et provenance par ligne | P1 | C05 | Fichier 2 795 lignes |
| D02 | Data | Comparer deux scrutins et tours identifiés | F | Ancien comparateur mélangeait des années | Sélection par année seule | Choix par ID scrutin/type/tour ; deux cartes synchronisées | P1 | T04 | Playwright, navigateur |
| D03 | Data | Résultats au bureau de vote | P | Bibliothèque intégrée communale | Agrégation initiale | Import de résultats par bureau, contrôle du rattachement | P1 | C05/C06 | UI d'import ; corpus bureau absent |
| D04 | Data | Indicateurs INSEE récents | P | Sélection communale 2023 seulement | Sources et millésimes variés | Vérifier actualité et exhaustivité par indicateur | P1 | T03/C05 | Métadonnées socio 2023 |
| D05 | Data | Croiser électoral et sociodémographique | P | Score exploratoire non sauvegardé | Calcul local par commune | Documenter hypothèses et sauvegarder analyses | P1 | T03 | UI Priorité d'action |
| D06 | Data | Fiches territoriales | P | Indicateurs limités | Corpus partiel | Enrichir sans inventer de valeurs | P1 | T02 | Fiche commune |
| D07 | Data | Exports CSV, Excel et PDF | P | CSV disponible, autres formats absents | Export incomplet | Exports XLSX/PDF sourcés | P1 | C04 | Bouton CSV |
| D08 | Data | Sauvegarder les analyses | M | Filtres et comparaison non enregistrés | État mémoire | Modèle d'analyse versionné | P1 | T11 | Aucun parcours |
| A01 | Action | Mission et statut | F | Fonction locale | Pas de serveur public | Création/édition, statut et liste | P0 | T07/T08 | Navigateur |
| A02 | Action | Zone, ID et géométrie depuis carte | F | Ancien secteur ambigu | Recherche par commune | ID exact, géométrie et communes dans l'action | P0 | T07 | Playwright, CI |
| A03 | Action | Rues reprises dans la mission | P | Catalogue d'une seule commune | Voies non géométriques | Multi-sélection Saint-André, autres communes à couvrir | P0 | T05/T07 | Navigateur |
| A04 | Action | Carte et progression des actions | F | Contour de l'action absent malgré les données enregistrées | Validation rejetait un polygone à un seul anneau | Corriger la validation, conserver statut et contour dans la couche | P0 | T08 | Playwright desktop et portable, après CI finale |
| A05 | Action | Marchés, porte-à-porte et autres types | F | Liste statique | Pas de catalogue admin | Types présents | P1 | C08 | Formulaire |
| A06 | Action | Volontaires, souhaits et affectations | P | Groupe/volontaire local | Pas de registre partagé | Base privée et permissions | P1 | T09/C07 | Formulaire local |
| A07 | Action | Calendrier et tournées | M | Pas de planificateur complet | Modèle de données sommaire | Planifier, tracer, affecter | P1 | T09 | Aucun parcours |
| A08 | Action | Notifications push et e-mail | B | Cases « à prévoir » seulement | Domaine/fournisseur absents | Fournisseur sécurisé, consentement et essais réels | P1 | C02 | Aucun envoi |
| A09 | Action | Synchronisation ordinateur/mobile | B | Pages statique, /api/ absent | Serveur non déployé | Déployer API privée et tester conflits | P0 | T10 | 404 /api/session |
| A10 | Action | Hors ligne et résolution des conflits | B | Cache shell local, pas de synchronisation | Backend indisponible | File de changements et conflits explicites | P1 | C09 | Bloqué |
| C01 | Contacts | Contacts volontairement inscrits | P | LocalStorage public non sécurisé pour du réel | Serveur/permissions absents | Réserver aux données fictives ; migrer en espace privé | P0 | C01 | Création fictive Playwright |
| C02 | Contacts | Consentement et suppression | P | Case et retrait local seulement | Pas d'audit ni traçabilité | Journal des consentements en privé | P1 | C01 | Formulaire et bouton |
| C03 | Contacts | Modification de fiche | M | Ajout/suppression seuls | Pas d'édition | Édition sécurisée et historique | P1 | C01 | Non testé, parcours absent |
| C04 | Contacts | Historique des communications | M | Brouillons non envoyés | Fournisseur absent | Journal d'envois autorisés | P1 | C01 | Aucun envoi |
| C05 | Contacts | Rôles et exports sécurisés | B | Données locales sans compte | Backend non déployé | Droits, chiffrement, export encadré | P1 | C07 | Bloqué |
| E01 | Événements | Créer et inscrire | F | Ancien gestionnaire ignorait la classe du formulaire | Sélecteur erroné | Gestion de .event-register-form | P0 | C02 | Playwright, CI |
| E02 | Événements | Places restantes | F | Inscription ne modifiait rien | Soumission non capturée | Compteur, capacité, persistance locale | P0 | C02 | Playwright, CI |
| E03 | Événements | Confirmation réelle | B | Simulation uniquement | Domaine/fournisseur absents | Envoi sécurisé et journal | P1 | C02 | Aucun e-mail |
| F01 | Financement | Registre de simulation | P | Montants fictifs locaux | Prototype | Total confirmé et journal visibles | P1 | C03 | UI ; pas de vraie transaction |
| F02 | Financement | Historique non destructif | M | Statut saisi initialement, pas de journal | Modèle local | Événements immuables et rapprochement | P1 | C03 | Non testé, parcours absent |
| F03 | Financement | Habilitations spécifiques | B | Aucun rôle financier public | API non déployée | Droits séparés, contrôle côté serveur | P1 | C07 | Bloqué |
| F04 | Financement | Justificatifs, exports comptables | M | Aucun | Service sécurisé absent | Pièces, rapprochement, export | P1 | C03 | Aucun parcours |
| F05 | Financement | Pages de collecte et paiement | B | Simulation explicite | Validation juridique/prestataire absents | Cadrage avant activation | P1 | C03 | Aucun paiement |
| I01 | Infrastructure | Dépôt privé source de référence | P | Racine privée et démo historiquement divergentes | Copies manuelles | Démo réintégrée dans demo/ | P0 | C10 | Commit privé |
| I02 | Infrastructure | Publication reproductible | B | Workflow préparé, non activé | Jeton et variable absents | Activer après contrôle du jeton limité | P0 | C10 | Workflow privé |
| I03 | Infrastructure | Tests bloquants avant Pages | F | Ancien workflow sans E2E | Simple upload | Node et Playwright avant déploiement | P0 | C10 | Run public |
| I04 | Infrastructure | Serveur HTTPS en France | B | Pas d'hôte en service | Domaine/OVH non configurés | Déployer API et sauvegardes | P0 | T10 | /api/ absent |
| I05 | Infrastructure | Interface mobile de terrain | P | 2 parcours Playwright mobile ; autres non testés | Couverture E2E limitée | Recette mobile réelle | P2 | T09 | CI quatre formats |
| I06 | Infrastructure | Assets locaux et souveraineté | P | Leaflet local, Google Fonts et tuiles IGN distantes | Ressources externes restantes | Héberger la police, stratégie de tuiles hors ligne | P2 | C09 | Assets locaux et requêtes visibles |
| I07 | Infrastructure | RGAA, mode sombre et performance | M | Audit non exécuté, mode sombre absent | Pas de recette dédiée | Audit accessibilité et optimisations | P2 | T09 | Non testé |
| I08 | Infrastructure | Sauvegarde/restauration | P | JSON local avec secteurs/préférences, non chiffré | Aucun stockage serveur | Sauvegarde sécurisée et restauration inter-appareils | P2 | T11 | Playwright, CI |

## Recette des douze critères cartographiques

| ID | Scénario et attendu | Obtenu | État | Environnement / preuve |
|---|---|---|---|---|
| T01 | Ouvrir carte, 87 polygones réels | 87 chemins vectoriels, contours locaux | Réussi | Site, Playwright quatre formats |
| T02 | Choisir Saint-André, voir contour et fiche | Surface orange et fiche code 33366, population 12 626 | Réussi | Site, Playwright |
| T03 | Changer couche, légende et valeurs | % ou €, source/minimum/missing ; 87 zones conservées | Réussi | Site, Playwright |
| T04 | Deux scrutins, deux cartes, tableau et sources | Municipales 2026 T1 / 2020 T1 par défaut, 87 écarts | Réussi | Playwright et site publié |
| T05 | Plusieurs rues localisées en traits | Deux rues sauvées dans mission, mais points BAN et aucun trait | Échoué | Site, deux rues vérifiées |
| T06 | Dessiner, enregistrer, éditer après reload | Polygone local, quatre sommets éditables et quatre points d'insertion après rechargement | Réussi localement | Playwright, navigateur, capture 06 |
| T07 | Action depuis secteur exact, géométrie et rues | ID/géométrie et deux rues conservés dans l'action | Réussi localement | Playwright, navigateur, captures 07/08 |
| T08 | Modifier statut et bordure carte | Statut « En cours » et deux contours orange visibles sur le site | Réussi localement | Playwright desktop/portable, navigateur |
| T09 | Session mobile avec périmètres/consignes selon droits | Carte mobile chargée, pas de session serveur et droits testés | Bloqué — infrastructure absente | CI mobile partielle |
| T10 | Mobile → ordinateur sans écrasement | /api/ absent sur GitHub Pages | Bloqué — infrastructure absente | 404 API |
| T11 | Rechargement actions/secteurs/paramètres | Actions, secteurs et préférences conservés localement ; export/restauration JSON vérifiés | Réussi localement | Playwright, navigateur |
| T12 | Aucune donnée fictive officielle ni fonction simulée déclarée réelle | Démo signalée ; provenance ligne par ligne non auditée contre originaux | Non testé complètement | Fichiers, mentions UI |

## Dix recettes complémentaires

| ID | Scénario / résultat attendu | Résultat observé | État | Preuve |
|---|---|---|---|---|
| C01 | Ajouter, modifier, supprimer contact fictif en privé | Ajout local testé, modification absente ; stockage local non sûr pour du réel | Échoué | CI, source |
| C02 | Créer événement, inscrire, places | Création, 1/2 place après reload | Réussi en simulation | CI |
| C03 | Transaction, statut, export, droits | Création fictive et total ; pas de modification/export/droits | Échoué | Source |
| C04 | CSV/XLSX, erreurs, doublons | Import existant, formats non traversés en E2E | Non testé | Source |
| C05 | Années, communes, totaux, sources | 2008–2026, 2 795 lignes, 87 communes, effectifs cohérents ; source non recoupée ligne à ligne | Partiel | Contrôle script local |
| C06 | GeoJSON bureaux, sélection, fiche | Import d'un contour de test, sélection et rendu ; corpus officiel absent | Réussi en import d'essai | Playwright quatre formats ; aucune géométrie inventée dans le corpus |
| C07 | Bénévole sans finances/réglages | API privée non déployée | Bloqué — infrastructure absente | Site statique |
| C08 | Deux campagnes sans fuite de mission | Modèle campaignId, parcours non automatisé | Non testé | Source |
| C09 | Hors ligne, compte rendu, retour réseau | Shell en cache, synchronisation absente | Bloqué — infrastructure absente | Code |
| C10 | Même source, tests et publication | Code de démo aligné dans privé et public ; publication automatique désactivée | Partiel | Commits et workflows |

## Décision de recette et travaux restants

Cette version **n'est pas conforme à l'ensemble des critères bloquants**. L'échec T05 et les blocages T09/T10 empêchent de revendiquer la livraison cartographique complète. Les livraisons A/B sont utilisables localement sur les parcours validés ; C est partielle ; D, E et F restent à industrialiser.

Prochaine séquence : 1) données linéaires de voies et liens adresses fiables ; 2) sauvegarde des analyses ; 3) déploiement d'une API privée HTTPS avec comptes, permissions, sauvegardes et recette de conflit mobile/ordinateur ; 4) périmètres de bureaux sourcés ; 5) contacts et finances sécurisés ; 6) police locale et audit RGAA. Aucun fichier nominatif réel ni paiement ne doit être publié sur GitHub Pages.

## Captures réelles du site publié

Les huit captures ci-dessous ont été prises dans un navigateur sur la version 0.10 publiée, après interactions. Elles montrent un jeu de données local fictif ; elles ne démontrent pas l'existence d'un service multiutilisateur. Les tests automatiques ont utilisé les quatre formats 1440 × 900, 1280 × 800, 390 × 844 et 412 × 915. Aucune capture de « tournée mobile » n'est fournie : le parcours avec session, droits et synchronisation n'existe pas encore.

| Vue | Capture | Ce qu'elle prouve et limite |
|---|---|---|
| Tableau de bord | [01 — Tableau de bord](https://github.com/NicolasTellier/democraction-demo/blob/main/docs/captures/01-tableau-de-bord.jpg) | Vue de démonstration ; chiffres locaux |
| Carte des communes | [02 — Carte](https://github.com/NicolasTellier/democraction-demo/blob/main/docs/captures/02-carte-communes.jpg) | Surfaces visibles, 87 polygones contrôlés dans le DOM |
| Commune choisie | [03 — Saint-André](https://github.com/NicolasTellier/democraction-demo/blob/main/docs/captures/03-commune-selectionnee.jpg) | Contour translucide, fiche et code INSEE 33366 |
| Couche Insee | [04 — Revenu médian](https://github.com/NicolasTellier/democraction-demo/blob/main/docs/captures/04-couche-insee.jpg) | Légende en euros, quantiles, millésime 2023 |
| Comparaison électorale | [05 — Deux cartes](https://github.com/NicolasTellier/democraction-demo/blob/main/docs/captures/05-comparateur.jpg) | Municipales 2026/2020 tour 1 ; 87 lignes vérifiées |
| Secteur éditable | [06 — Édition](https://github.com/NicolasTellier/democraction-demo/blob/main/docs/captures/06-edition-secteur.jpg) | Sommets et points intermédiaires visibles ; stockage local |
| Liste des actions | [07 — Actions](https://github.com/NicolasTellier/democraction-demo/blob/main/docs/captures/07-actions.jpg) | Action fictive enregistrée et statut « En cours » |
| Action depuis la carte | [08 — Formulaire prérempli](https://github.com/NicolasTellier/democraction-demo/blob/main/docs/captures/08-action-depuis-carte.jpg) | Commune et secteur repris ; la persistance est démontrée par T07 |

## Version, tests et publication

- **Source principale** : `NicolasTellier/democraction`, code consolidé dans `demo/` au commit `3aa4fe912a3da3ca106a6154d80636d79babfc45` ; le rapport est ajouté par un commit documentaire ultérieur.
- **Paquet public** : `NicolasTellier/democraction-demo`, code au commit `b940580199c2e7f4d974adbafd1b3f55c2eec895` ; le rapport et les captures sont ajoutés ensuite sans modifier le code applicatif. Les fichiers de code de démonstration des deux dépôts sont alignés.
- **Tests unitaires locaux** : 3 réussis ; géométrie, 87 codes INSEE et restauration. **Recette navigateur** : 16 passages réussis sur quatre formats, quatre cas volontairement sautés sur téléphone car ils demandent une recette manuelle complémentaire. Les contrôles critiques incluent contours, sélection, légende, comparaison, secteurs, actions, sauvegarde et import de bureaux d'essai. [Publication publique validée](https://github.com/NicolasTellier/democraction-demo/actions/runs/43573368162), [paquet privé validé](https://github.com/NicolasTellier/democraction/actions/runs/43573376538), [tests du serveur privé réussis](https://github.com/NicolasTellier/democraction/actions/runs/43573376657).
- **Publication** : workflow public conditionné à `npm run check`, `npm test` et Playwright avant le déploiement Pages. Le workflow privé de validation du paquet exécute les mêmes parcours ; la publication automatique privée → publique reste désactivée tant qu'un jeton de portée limitée et sa variable de contrôle ne sont pas configurés.
- **URL vérifiée** : [démonstration DemocrAction](https://nicolastellier.github.io/democraction-demo/). Le contrôle navigateur a montré le script `map21`, 87 surfaces communales, deux cartes pour 2026 et 2020, 87 écarts, l'édition d'un secteur et des contours d'action orange après changement de statut.
