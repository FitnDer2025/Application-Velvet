# ADR-GROWTH-062 — Salle d’attente et préinscriptions Velvet

- **Statut :** accepté
- **Date :** 2026-08-06
- **Décideur produit :** Cyril
- **Périmètre :** Web, Velvet Contrôle, Velvet Marketing, Supabase

## Contexte

La V1 Velvet est prête à entrer en phase de test, mais le lancement public nécessite encore des moyens pour l’acquisition, l’infrastructure, la vérification d’identité et la modération. Velvet doit pouvoir constituer une première communauté régionale et démontrer sa traction avant l’ouverture complète et avant une démarche formelle auprès de financeurs.

## Décision

Velvet met en place une **salle d’attente publique premium** à l’adresse `/acces-prive/` avec deux parcours distincts :

1. préinscription membre ;
2. préinscription professionnelle.

Les personnes ne créent pas encore leur profil complet. Elles demandent un accès privé et sont informées que les invitations seront distribuées progressivement.

## Collecte minimale

La salle d’attente ne collecte jamais, avant l’ouverture du compte :

- pratiques ou préférences intimes ;
- orientation sexuelle détaillée ;
- description personnelle ;
- photo ou vidéo ;
- pièce d’identité ;
- géolocalisation précise.

Les seules données demandées sont celles nécessaires à la qualification du lancement : e-mail, type de public, ville ou code postal, pays, candidature bêta et, pour un professionnel, activité et coordonnées de contact.

L’attestation de majorité et le consentement explicite aux communications liées à la préinscription sont obligatoires et non précochés.

## Expérience publique

La page doit respecter l’ADN Velvet :

- univers graphite, bordeaux et champagne ;
- esthétique premium, minimaliste et cinématographique ;
- langage fondé sur la confiance, le consentement, la discrétion et la qualité ;
- aucun visuel explicite ou stéréotypé ;
- ouverture présentée comme progressive, sans faux quota ni fausse urgence.

Après inscription, le message confirme l’enregistrement et invite la personne à surveiller sa boîte mail. Un lien personnel de recommandation peut être proposé.

## Pilotage dans Velvet Contrôle

La salle d’attente appartient à la destination existante **Communications** de Velvet Contrôle ; elle ne crée pas une sixième destination principale.

Le cockpit `/control/acces-prive/` affiche :

- volume total ;
- répartition membres / professionnels ;
- nouvelles inscriptions sur sept jours ;
- candidats bêta ;
- invitations et conversions ;
- territoires les plus actifs ;
- sources et campagnes ;
- liste filtrable des préinscriptions ;
- export CSV ;
- changement d’état avec historique.

Lecture : rôles admin, direction, moderator, support et auditor. Modification des états : admin et direction uniquement.

## Campagne dans Velvet Marketing

Le module `/marketing/acces-prive/` fournit :

- publication principale régionale ;
- appel à bêta-testeurs ;
- communication Velvet Pro ;
- relance ;
- scénario de story en trois écrans ;
- règles éditoriales ;
- générateur de liens UTM par canal et par public ;
- copie directe des textes avec insertion du lien traçable.

## Sécurité et données

- La table de préinscription est protégée par RLS et n’accorde aucun accès direct aux rôles anon ou authenticated.
- L’écriture publique passe uniquement par une RPC dédiée et validée côté Worker.
- Le tableau de bord passe par des RPC qui contrôlent les rôles Velvet.
- Cloudflare Turnstile et un honeypot protègent le formulaire contre les robots.
- Les adresses e-mail ne sont jamais écrites dans les journaux applicatifs.
- Les changements d’état sont historisés.

## Dépendance de déploiement

La migration `supabase/migrations/20260806111500_velvet_waiting_room.sql` doit être exécutée manuellement par Cyril dans Supabase. Tant qu’elle n’est pas appliquée, les surfaces peuvent être déployées mais le formulaire indique que la liste d’accès est en cours d’activation et le cockpit affiche une alerte de migration.

## Critères de succès

La campagne doit mesurer en priorité :

- e-mails confirmés et préinscriptions valides ;
- équilibre des différents publics ;
- densité par territoire ;
- professionnels intéressés ;
- candidats bêta ;
- source réelle de chaque acquisition ;
- conversion d’une préinscription en compte actif.
