# Architecture cible V1

Statut : **PROPOSED — validation technique requise avant implémentation**

## Principes

- application web responsive et installable avant applications natives ;
- monolithe modulaire avant microservices ;
- PostgreSQL comme source de vérité ;
- services managés pour réduire les coûts d’exploitation ;
- sécurité et confidentialité conçues dès le schéma de données ;
- découplage des domaines Community, Professionals, Admin et Platform Core.

## Stack de référence

- Frontend : Next.js, TypeScript, React ;
- UI : composants accessibles, design tokens Zwit, Storybook lorsque le socle UI est stable ;
- Backend : routes serveur Next.js et fonctions isolées selon les besoins ;
- Données : Supabase PostgreSQL avec migrations versionnées ;
- Authentification : Supabase Auth ou prestataire équivalent validé ;
- Stockage : buckets séparés public, privé et quarantaine ;
- Paiement : adaptateur indépendant et page hébergée chez un prestataire acceptant explicitement l'activité et les contenus de Zwit ; aucun fournisseur n'est activé sans accord écrit ;
- Emails : Brevo ou Resend ;
- Recherche : PostgreSQL en V1, moteur dédié seulement si les métriques le justifient ;
- Analytics : PostHog avec collecte minimisée ;
- Monitoring : erreurs, disponibilité, latence et journaux d’audit ;
- Déploiement : Vercel et environnements Supabase distincts.

## Modules

### Platform Core

- accounts ;
- identities ;
- roles_permissions ;
- consent_records ;
- notifications ;
- audit_events ;
- billing ;
- feature_flags.

### Community

- member_profiles ;
- couple_memberships ;
- preferences ;
- media_assets ;
- album_grants ;
- discovery ;
- contacts ;
- conversations ;
- messages ;
- blocks ;
- reports.

### Professionals

- professional_accounts ;
- venues ;
- professional_team_members ;
- events ;
- ticket_types ;
- capacities ;
- reservations ;
- waitlist_entries ;
- checkins ;
- refunds.

### Admin & Trust

- verification_cases ;
- moderation_cases ;
- sanctions ;
- appeals ;
- support_cases ;
- incident_records.

## Règles de sécurité minimales

- aucune table sensible accessible directement sans politique explicite ;
- Row Level Security activée par défaut ;
- URLs signées et courtes pour les médias privés ;
- retrait immédiat d’un accès album révoqué ;
- données d’identité séparées des profils publics ;
- secrets uniquement dans les coffres des environnements ;
- actions administratives journalisées ;
- limitation de débit sur authentification, messagerie, recherche et signalement ;
- chiffrement en transit et au repos par les prestataires ;
- données de production interdites dans les environnements de développement.

## Règles de données

- identifiants UUID ;
- dates en UTC ;
- suppression logique uniquement lorsqu’une obligation d’audit le justifie ;
- politique de conservation documentée par catégorie ;
- migrations ascendantes et reproductibles ;
- jeux de données de démonstration fictifs ;
- contraintes de base de données pour les invariants critiques.

## Paiement

Zwit ne doit pas conserver de données de carte. Les responsabilités de marketplace, encaissement pour compte de tiers, remboursement, fiscalité et KYC professionnel doivent être validées juridiquement avant activation.

## Performance V1

La V1 optimise les parcours mesurés, pas une hypothétique échelle nationale. Les index, caches et traitements asynchrones sont ajoutés sur la base de métriques. Les médias sont transformés, limités et distribués via CDN.

## Décisions encore ouvertes

- prestataire définitif de vérification d’identité ;
- prestataire de paiement et schéma contractuel ;
- règles exactes de conservation ;
- stratégie de modération automatisée ;
- hébergement final selon analyse RGPD ;
- niveau de chiffrement applicatif pour certains champs.

Ces points doivent faire l’objet d’ADR dédiées avant codage définitif.
