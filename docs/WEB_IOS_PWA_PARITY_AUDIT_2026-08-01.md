# Audit de parité Velvet — iOS, Web desktop et Web mobile/PWA

Date : mise à jour du 3 août 2026
Périmètre : espace Membres Velvet, environnement BETA privé.

## Conclusion

La version iOS validée reste inchangée et sert de référence. Web desktop et Web mobile/PWA reposent désormais sur le cœur fonctionnel Membres complet, les mêmes API et les mêmes données métier pour l’accueil communautaire, la recherche de profils, les établissements, les sorties, les participants, la messagerie et le profil.

La V1.1 Web supprime l’ancienne concurrence entre une application complète et une couche de parité simplifiée : `members-live.js` redevient l’unique moteur fonctionnel, tandis que `velvet-web-ios-parity.js` se limite au shell responsive, à la synchronisation de la navigation et au menu mobile. Cette séparation évite les écrans incomplets, les doubles gestionnaires de contenu et les couches invisibles bloquant les clics.

Le correctif de stabilité du 3 août complète cette séparation : le menu mobile possède désormais un contrôleur unique pour l’ouverture, le voile, l’accessibilité et la fermeture ; les anciens contrôleurs du cœur Membres, de la messagerie, du fil mobile et de la couche Premium ne modifient plus son état ; le pseudo-voile historique de la messagerie, qui recouvrait le tiroir, est supprimé. L’autorisation Web Push est déclenchée directement par le commutateur ; le double bandeau de consultation est retiré du fil ; les médias des agents IA disposent d’une signature serveur de secours strictement limitée aux environnements internes autorisés.

Les contrôles automatisés de la V1.1 couvrent notamment :

- validation syntaxique Node de toutes les couches Web/API concernées ;
- 100 tests de contrats fonctionnels réussis ;
- contrôles Supabase/RLS réussis sur 60 tables protégées ;
- 37 parcours de persistance contrôlés ;
- 23 parcours utilisateurs bout en bout contrôlés ;
- build BETA Web/PWA réussi ;
- garde-fou Git confirmant qu’aucun fichier du dossier `ios/` n’est modifié par cette livraison Web.

## Navigation commune

Les trois interfaces exposent cinq espaces principaux :

1. Accueil
2. Membres
3. Lieux
4. Messages
5. Profil

Les notifications et paramètres restent disponibles comme outils secondaires afin de ne pas surcharger le parcours principal.

## Accueil communautaire

Le même ordre fonctionnel que `PeopleFirstHomeView` est appliqué :

1. salutation personnalisée ;
2. sélection « À découvrir » avec les derniers profils et recommandations ;
3. fil communautaire vertical et non figé.

Le fil exploite les mêmes sources pour afficher :

- nouvelle inscription ;
- nouvelle photo ;
- profil enrichi ou modifié ;
- prochaine sortie ;
- réaction reçue sur une photo, avec aperçu de la photo concernée ;
- activité suivie et recommandation communautaire.

La sélection est contextualisée par les préférences, les affinités, le rayon de découverte et la proximité lorsque cette dernière est disponible.

## Recherche de profils

La recherche avancée demeure accessible depuis Membres sur les trois interfaces. Les critères, profils, types démographiques, âges, photos et données d’affinité proviennent du même annuaire Membres.

## Clubs et établissements

La recherche interroge l’intégralité de `venueDirectory`, sans filtre initial bloquant. Elle couvre :

- nom ;
- ville ;
- catégorie ;
- type ;
- tags ;
- adresse publique ;
- région et pays lorsqu’ils sont disponibles.

Les résultats sont classés par proximité lorsque la distance est connue, puis par nom.

## Sorties et présences

Les trois interfaces utilisent le même modèle `profile_venue_visits` via `/api/members/plans`.

Le parcours commun est :

1. choisir un établissement ;
2. choisir une date ;
3. publier « J’y serai » pour un profil individuel ou « Nous y serons » pour un couple ;
4. rendre la sortie visible sur le profil et dans l’actualité ;
5. regrouper les participants par établissement et par date ;
6. ouvrir directement les fiches des participants visibles.

## Web mobile/PWA

Le service worker utilise le cache `velvet-beta-shell-v24` et supprime les versions précédentes à l’activation. Le cœur Membres complet et le shell responsive V1.1 sont versionnés ensemble dans le cache applicatif.

Le rendu responsive conserve :

- cinq destinations dans la barre basse ;
- cartes et boutons dimensionnés pour le tactile ;
- formulaire de sortie en une colonne sur petit écran ;
- listes d’établissements et de participants sans débordement horizontal ;
- comportement plein écran de la messagerie existante.
- ouverture du menu secondaire au-dessus du voile, sans couche noire bloquante ;
- activation immédiate des notifications depuis le commutateur ou le bouton de test.

## Protection contre les régressions

Le shell de compatibilité ne produit plus aucun contenu métier. Il synchronise uniquement les cinq destinations, l’état actif, le menu secondaire et le scrim mobile ; toutes les pages et actions sont rendues par le cœur Membres.

La suite `web-ios-community-parity.test.mjs` vérifie notamment :

- les cinq espaces communs ;
- l’ordre de l’accueil communautaire ;
- les catégories d’activité ;
- l’annuaire complet des établissements ;
- la formulation individuel/couple ;
- l’écriture dans le modèle partagé des sorties ;
- l’affichage des participants ;
- le responsive et le cache PWA.

## Vérification réelle après déploiement

Les contrôles automatisés valident le code et les contrats. La dernière validation terrain consiste à ouvrir le compte BETA authentifié sur :

- un iPhone avec l’application native ;
- Safari mobile ou la PWA installée ;
- un navigateur desktop.

Le même test doit confirmer : accueil, ouverture d’un profil, recherche d’un établissement, publication d’une sortie, apparition dans l’actualité et consultation de la liste des participants.
