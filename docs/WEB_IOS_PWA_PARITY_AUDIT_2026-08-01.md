# Audit de parité Velvet — iOS, Web desktop et Web mobile/PWA

Date : 1er août 2026  
Périmètre : espace Membres Velvet, environnement BETA privé.

## Conclusion

Les trois interfaces reposent désormais sur les mêmes parcours, les mêmes API et les mêmes données métier pour l’accueil communautaire, la recherche de profils, les établissements, les sorties et les participants.

Les contrôles automatisés n’ont détecté aucune anomalie bloquante après synchronisation :

- validation syntaxique Node de toutes les couches Web/API concernées ;
- 91 tests de contrats fonctionnels réussis ;
- contrôles Supabase/RLS réussis sur 60 tables protégées ;
- 37 parcours de persistance contrôlés ;
- 23 parcours utilisateurs bout en bout contrôlés ;
- build BETA Web/PWA réussi ;
- compilation Apple validée précédemment pour l’application iPhone, le widget iPhone, l’application Apple Watch et sa complication.

## Navigation commune

Les trois interfaces exposent quatre espaces principaux :

1. Accueil
2. Navigation
3. Messages
4. Profil

Les notifications et paramètres restent disponibles comme outils secondaires afin de ne pas surcharger le parcours principal.

## Accueil communautaire

Le même ordre fonctionnel est appliqué :

1. salutation personnalisée ;
2. derniers profils et recommandations Velvet Intelligence ;
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

La recherche avancée demeure accessible depuis Navigation sur les trois interfaces. Les critères, profils, types démographiques, âges, photos et données d’affinité proviennent du même annuaire Membres.

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

Le service worker utilise le cache `velvet-beta-shell-v19` et supprime les versions précédentes à l’activation. Les nouvelles couches communautaires, de navigation et de compatibilité sont incluses dans le cache applicatif.

Le rendu responsive conserve :

- quatre destinations dans la barre basse ;
- cartes et boutons dimensionnés pour le tactile ;
- formulaire de sortie en une colonne sur petit écran ;
- listes d’établissements et de participants sans débordement horizontal ;
- comportement plein écran de la messagerie existante.

## Protection contre les régressions

Une couche de compatibilité empêche les anciens enrichissements JavaScript d’injecter une seconde page d’accueil ou de perturber la navigation unifiée.

La suite `web-ios-community-parity.test.mjs` vérifie notamment :

- les quatre espaces communs ;
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
