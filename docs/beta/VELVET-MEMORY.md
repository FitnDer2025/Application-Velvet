# Mémoire Velvet — architecture et migration BETA

## Principe

La « mémoire Velvet » est la source de vérité commune à Velvet Membres, Velvet
Pro, Velvet Control et Velvet Intelligence. Une donnée métier n’est créée qu’une
fois puis exposée selon le rôle, le consentement, la visibilité et la relation
entre les personnes.

Le schéma initial est défini dans `infra/supabase/migrations/`. Il comporte
27 tables protégées par Row Level Security.

## Domaines

| Domaine | Tables principales | Accès |
|---|---|---|
| Accès BETA | `beta_invites`, `accounts`, `roles`, `account_roles` | utilisateur concerné ou Control habilité |
| Consentements | `consent_records`, `data_subject_requests` | utilisateur concerné ou équipe RGPD habilitée |
| Membres | `member_profiles`, `profile_members`, `individual_profiles`, `circles`, `favorites` | propriétaire, cercle autorisé, BETA active ou Control selon sa mission |
| Professionnels | `establishments`, `establishment_staff` | membres selon visibilité, équipe de l’établissement ou Control |
| Organisateurs | `organizer_profiles` | profil organisateur et équipe Control habilitée |
| Sorties | `events`, `event_registrations`, `recommendations` | visibilité de la sortie, participant, organisateur, Pro ou Control |
| Conversations | `conversations`, `conversation_members`, `messages` | participants uniquement ; accès Control à encadrer par mission et journalisation |
| Albums | `albums`, `media_assets`, `album_access_grants` | propriétaire ou bénéficiaire d’un droit actif |
| Sécurité | `blocks`, `reports`, `audit_events` | auteur concerné et équipes habilitées |

## Frontières de confidentialité

- Un compte `pending_consent` ne peut pas parcourir les profils.
- Une adresse non invitée ne peut pas créer de compte.
- Un média est privé par défaut et servi depuis un bucket non public.
- Un album privé ne révèle ni miniature, ni nom de fichier, ni métadonnée avant
  l’octroi d’un droit actif.
- Une conversation est invisible aux non-participants.
- Un blocage masque les profils dans les deux sens.
- Les actions administratives et IA sensibles sont inscrites dans un journal
  append-only.
- La localisation précise est séparée de la zone publique et nécessite un choix
  spécifique.

## Migration progressive

### Lot 0 — validation technique

- comptes internes uniquement ;
- données synthétiques ;
- tests RLS, sauvegarde/restauration, export et suppression ;
- aucune photo intime réelle.

### Lot 1 — profils invités

- création des comptes depuis une invitation ;
- consentements versionnés ;
- profil couple et fiches individuelles ;
- photos non explicites uniquement pendant le pilote ;
- contrôle de visibilité et blocage.

### Lot 2 — établissements et sorties

- import des établissements après validation des droits sur les données ;
- création des équipes Pro ;
- événements et inscriptions ;
- vérification croisée entre Velvet Membres et Velvet Pro.

### Lot 3 — albums privés

- bucket privé ;
- analyse antivirus et modération avant publication ;
- octroi et retrait d’accès ;
- expiration automatique des albums temporaires ;
- interdiction de cache public.

### Lot 4 — conversations

- ouverture aux seuls participants actifs ;
- chiffrement au repos et TLS en transit ;
- règles de conservation validées ;
- signalement et blocage opérationnels ;
- absence de lecture humaine systématique.

### Lot 5 — Control et Intelligence

- dossiers construits à partir d’événements minimisés ;
- accès par mission ;
- décisions automatiques configurables ;
- justification, validation humaine et audit pour les cas sensibles.

## Règles d’import

1. Aucun import direct depuis `localStorage` vers la production.
2. Chaque import est idempotent et conserve un identifiant de source.
3. Les données sont validées dans une table de transit avant insertion métier.
4. Les médias sont copiés dans le bucket privé, analysés, puis référencés.
5. Les comptes réels ne sont jamais créés sans invitation et confirmation e-mail.
6. Les données sensibles ne sont publiées qu’après consentement explicite.
7. Chaque lot possède un contrôle de volume, d’intégrité, de droits et une
   procédure de retour arrière.

## Critères de passage aux données réelles

- AIPD validée ;
- responsables et sous-traitants documentés ;
- durées de conservation approuvées ;
- information de confidentialité finalisée ;
- parcours 18+ validé juridiquement ;
- RLS testée avec comptes Membre, Pro, Organisateur et Control ;
- sauvegarde et restauration testées ;
- export, rectification, retrait de consentement et suppression testés ;
- réponse aux incidents documentée.
