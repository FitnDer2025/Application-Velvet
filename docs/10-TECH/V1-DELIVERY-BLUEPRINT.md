# Blueprint de livraison — Maquette V1 Zwit

## Objectif
Fournir à l'équipe de développement et à CODEX un cadre exécutable pour transformer Zwit OS en une maquette V1 testable, puis en base de production.

## Principe d'architecture
Architecture modulaire, mobile-first, sécurisée par défaut et compatible Web/PWA puis applications mobiles.

## Domaines fonctionnels
- Authentification et onboarding
- Identité individuelle et couple
- Profils, photos publiques et privées
- Discover et recommandations
- Invitations Zwit
- Salons Zwit
- Carnet Zwit privé
- Histoire de la relation
- Événements, sorties et voyages
- Bulles et publications
- Réputation, confiance, signalement et blocage
- Professionnels
- Zwit Intelligence et Zwit Memory
- Administration et modération

## Architecture logique recommandée pour la V1

### Frontend
- Application Web responsive et installable en PWA.
- Design system partagé.
- Composants accessibles.
- Navigation mobile-first.
- Gestion centralisée des états serveur et session.

### Backend
- API versionnée.
- Service d'authentification.
- Base relationnelle.
- Stockage objet privé pour médias.
- Temps réel pour conversations et statuts.
- File de tâches pour notifications, modération média et traitements asynchrones.

### Sécurité
- Autorisation au niveau des lignes ou équivalent côté serveur.
- URLs média signées et à durée limitée.
- Séparation stricte Salon partagé / Carnet privé.
- Journal d'audit pour consentements, ajouts de participants, accès aux albums privés et actions de modération.
- Chiffrement en transit et au repos selon capacités de l'infrastructure.
- Aucun secret dans le client ou le dépôt.

## Entités minimales V1
- `users`
- `profiles`
- `couples`
- `couple_members`
- `profile_media`
- `private_album_grants`
- `invitations`
- `salons`
- `salon_members`
- `messages`
- `message_receipts`
- `salon_events`
- `private_notebook_entries`
- `relationship_milestones`
- `blocks`
- `reports`
- `notifications`
- `consent_audit_logs`

Les noms sont indicatifs ; les migrations doivent rester cohérentes avec les ADR.

## Règles critiques à implémenter côté serveur
- Une Invitation Zwit non acceptée ne permet aucun second message.
- L'ajout d'un participant à un Salon exige l'accord explicite de tous les membres présents.
- Le nouveau participant ne voit que l'historique autorisé lors de son entrée.
- Le Carnet Zwit n'est jamais accessible aux autres membres du Salon.
- Les statuts de lecture respectent la préférence de confidentialité et la réciprocité.
- Les captures d'écran ne génèrent un événement que lorsqu'un signal fiable existe.
- Le blocage coupe immédiatement les accès et interactions futures applicables.

## Environnements
- `local`
- `preview`
- `staging`
- `production`

Chaque environnement doit posséder ses propres secrets, base de données, stockage et configuration de notifications.

## CI/CD minimale
À chaque pull request :
- lint
- vérification des types
- tests unitaires
- tests d'intégration critiques
- build
- scan de secrets et dépendances

Avant production :
- migrations vérifiées
- sauvegarde et rollback documentés
- tests end-to-end critiques
- revue sécurité
- validation produit

## Observabilité
- Logs structurés avec corrélation de requêtes.
- Suivi des erreurs frontend et backend.
- Métriques de disponibilité, latence, erreurs et files de tâches.
- Aucun contenu intime ou média dans les logs.

## Données et conformité
- Minimisation des données.
- Consentement explicite pour géolocalisation, notifications et données sensibles.
- Export et suppression de compte prévus dès la conception.
- Durées de conservation documentées avant production.
- Les exigences juridiques et RGPD doivent faire l'objet d'une validation dédiée avant ouverture publique.

## Stratégie de livraison
1. Socle technique et design system.
2. Authentification et onboarding.
3. Profils et couples.
4. Discover et Invitations Velvet.
5. Salons, messages et statuts.
6. Médias privés et consentements.
7. Confiance, blocage et signalement.
8. Événements et modules relationnels progressifs.
9. Administration et observabilité.
10. Durcissement production.

## Points encore à arbitrer
- Stack technique finale.
- Durée d'expiration des invitations.
- Hébergeur et région de données.
- Politique détaillée de conservation.
- Niveau de chiffrement applicatif des conversations.
- Périmètre exact des apps natives dans la V1.

Ces points doivent rester `TBD` jusqu'à validation ; CODEX ne doit pas les transformer en décision produit implicite.
