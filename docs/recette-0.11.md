# DemocrAction — recette et limites 0.11

14 novembre 2026. Suite de [l'audit 0.10](audit-recette-0.10.md). Ce rapport distingue une fonction effectivement vérifiée de son interface et d'une intention d'architecture.

## Réalisation

| Fonction | État 0.11 | Vérification / limite |
|---|---|---|
| 87 communes en surfaces ; EPCI et cantons ; comparaison de scrutins | Conservée | Tests antérieurs + suite Playwright. Les bureaux demandent un GeoJSON officiel importé. |
| Voies nommées en lignes | Implémentée | 303 géométries IGN de la commune 33366 dans le paquet ; autres communes par WFS IGN, suivant disponibilité du réseau. Relevé et source affichés. |
| Recherche et sélection de plusieurs rues | Implémentée | Chemins sélectionnés en orange ; sélection reprise avec les identifiants et la géométrie dans une action. |
| Action depuis les rues ; persistance | Implémentée localement | Géométrie `MultiLineString` et `roadIds` admis en sauvegarde/restauration. Liste, agenda, Kanban, historique et bilan par secteur sont des vues locales de ces actions. |
| Adresses publiques | Partielle | BAN WFS par rue sélectionnée, points et fiche d'adresse sans personne. Le réseau est nécessaire. Aucun rapprochement avec un contact, car la démo est publique. |
| Priorisation électorale et socio-démographique | Partielle | Indice communal descriptif, poids et méthode expliqués. Composante électorale écartée si moins de 30 inscrits ; composante socio écartée si moins de 100 habitants. Aucun score individuel. Référentiels à contrôler avant usage réel. |
| Secteurs dessinés et actions associées | Conservée | Stockage local et export GeoJSON ; absence d'administration multiutilisateur. |
| Contacts consentants fictifs | Partielle | Démo locale : formulaire et suppression dans ce navigateur. Aucune garantie de confidentialité ou contrôle serveur pour des personnes réelles. |
| Rôles et synchronisation | Non déployées | Formulaire de connexion présent, mais aucune API sous GitHub Pages. Le backend privé Node/SQLite ne couvre pas encore quatre rôles, l'affectation fine et la file hors ligne. |
| Imports privés, quarantaine et données individuelles | Non disponibles | L'import public n'accepte que les colonnes électorales agrégées ; aucune liste électorale nominative n'est importée ici. |
| Notifications réelles | Non disponibles | Les cases dans le formulaire sont des souhaits enregistrés ; aucun push ni e-mail n'est envoyé. |

## Sources, hypothèses et échelle

- **Rues** : [IGN, service WFS](https://cartes.gouv.fr/aide/fr/guides-utilisateur/utiliser-les-services-de-la-geoplateforme/diffusion/wfs/), couche `BDTOPO_V3:voie_nommee`, filtre INSEE ; instantané `data/voies-33366.geojson` du 14 novembre 2026 (303 lignes, code `33366`). Les voies ne sont pas des limites de bureaux ou d'adresses. Les mises à jour du service peuvent différer de la copie locale.
- **Adresses** : [Base Adresse Nationale](https://adresse.data.gouv.fr/commune/33366) via `BAN.DATA.GOUV:ban`, chargement WFS au clic, filtre code INSEE et identifiant FANTOIR ou nom de voie. Une adresse n'indique ni personne ni électeur. Certaines voies peuvent n'avoir aucune adresse retournée.
- **Résultats** : ministère de l'Intérieur, données électorales communales et années 2008–2026 dans le paquet ; le bureau n'apparaît que pour un import agrégé valide, ses contours restent absents tant que la source officielle n'est pas fournie. La comparaison entre types de scrutin différents appelle de la prudence.
- **Insee** : millésimes et provenance dans `data/socio-demographie-v3.json`, agrégats communaux. Les poids de l'indice s'appliquent après normalisation min–max sur les communes visibles, ce qui rend les scores sensibles aux filtres. Un chiffre manquant n'est pas remplacé par une valeur inventée.

## Vérifications et preuves

| Contrôle | Résultat |
|---|---|
| Syntaxe et tests Node | 5 tests réussis en local : géométries 87/303, recherche, sélection, sauvegarde et refus des géométries invalides. |
| Recette navigateur | Suite de parcours sur quatre dimensions dans GitHub Actions, condition de publication. Le navigateur local isolé n'a pas pu démarrer Chromium ; la validation sur le site publié et le run CI seront inscrits ici après déploiement. |
| Confidentialité du paquet | Paquet public filtré par workflow. Les données cartographiques n'associent aucune identité aux adresses. Le formulaire local n'est utilisable qu'avec des identités fictives. |

## Chemin vers une application privée

Le choix d'un hébergement et sa configuration DNS/HTTPS restent extérieurs à GitHub Pages. Le dépôt privé contient un serveur Node/SQLite avec comptes `admin`, `terrain`, `lecture`, révision et journal d'audit pour des statuts d'action. Il n'est pas une plateforme collaborative complète. La prochaine mise en production exige notamment :

1. Une base serveur séparant cartes et agrégats publics, actions, secteurs, équipes, contacts consentants, sources, durées de conservation et journal d'accès. PostgreSQL avec sauvegardes chiffrées est une option, à choisir avant migration ; la version actuelle utilise SQLite.
2. Authentification HTTPS, rôles `administrateur`, `coordinateur`, `volontaire`, `lecteur`, affectations par action et contrôles **côté serveur** sur chaque requête. Aucun rôle affiché seulement dans l'interface ne suffit.
3. API d'actions avec identifiant stable, horodatage, journal et révision par objet ; file locale hors ligne, reprise, dédoublonnage et conflits à résoudre explicitement. Deux appareils et un conflit réel doivent être testés avant toute annonce de synchronisation.
4. Parcours de consentement, suppression/anonymisation et export individuel ; import privé en quarantaine avec validation humaine, provenance et durée de conservation. Ne pas renommer des données politiques individuelles pour contourner leur exclusion.
5. Fournisseur d'e-mail et de notifications, domaine d'envoi, vérification des abonnements, journal de livraison et tests réels. Rien n'est envoyé dans la démo.

Pour la démo statique, aucune variable d'environnement ni secret n'est nécessaire. La configuration du serveur privé doit être définie et documentée dans son dépôt après choix de l'hôte ; ne jamais la placer dans ce dépôt Pages. Voir [README](../README.md) pour les commandes d'installation et de déploiement.
