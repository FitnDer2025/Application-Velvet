import { readFile } from 'node:fs/promises';

const core = await readFile('infra/supabase/migrations/0001_velvet_beta_core.sql', 'utf8');
const rls = await readFile('infra/supabase/migrations/0002_velvet_beta_rls.sql', 'utf8');
const storage = await readFile('infra/supabase/migrations/0003_velvet_beta_storage.sql', 'utf8');
const inviteFix = await readFile('infra/supabase/migrations/0004_fix_invite_crypto_schema.sql', 'utf8');
const grants = await readFile('infra/supabase/migrations/0005_authenticated_api_grants.sql', 'utf8');
const neutralBeta = await readFile('infra/supabase/migrations/0006_neutral_beta_profiles.sql', 'utf8');
const sharedCouple = await readFile('infra/supabase/migrations/0007_shared_couple_ownership.sql', 'utf8');
const memberOnboarding = await readFile('infra/supabase/migrations/0008_member_onboarding_identity.sql', 'utf8');
const photoAdmission = await readFile('infra/supabase/migrations/0009_photo_admission_and_venue_directory.sql', 'utf8');
const memberPreferences = await readFile('infra/supabase/migrations/0010_member_privacy_notifications_pwa.sql', 'utf8');
const stagedCouple = await readFile('infra/supabase/migrations/0011_couple_first_parallel_onboarding.sql', 'utf8');
const locationVerification = await readFile('infra/supabase/migrations/0012_optional_location_identity_age_foundation.sql', 'utf8');
const memberEngagement = await readFile('infra/supabase/migrations/0013_profile_memory_reactions_conversation_streaks.sql', 'utf8');
const photoInteractions = await readFile('infra/supabase/migrations/0014_photo_reactions_control_invites_persistence.sql', 'utf8');
const memberActions = await readFile('infra/supabase/migrations/0015_member_actions_conversations_events.sql', 'utf8');
const memberNotifications = await readFile('infra/supabase/migrations/0016_member_notifications.sql', 'utf8');
const proWorkspace = await readFile('infra/supabase/migrations/0017_velvet_pro_workspace.sql', 'utf8');

const migrationBundle = `${core}\n${neutralBeta}\n${sharedCouple}\n${memberOnboarding}\n${photoAdmission}\n${memberPreferences}\n${stagedCouple}\n${locationVerification}\n${memberEngagement}\n${photoInteractions}\n${memberActions}\n${memberNotifications}\n${proWorkspace}`;
const tables = [...migrationBundle.matchAll(/create table(?: if not exists)? public\.([a-z_]+)/gi)].map((match) => match[1]);
const rlsSources = `${rls}\n${neutralBeta}\n${sharedCouple}\n${memberOnboarding}\n${photoAdmission}\n${memberPreferences}\n${stagedCouple}\n${locationVerification}\n${memberEngagement}\n${photoInteractions}\n${memberActions}\n${memberNotifications}\n${proWorkspace}`;
const missingRls = tables.filter((table) => !rlsSources.includes(`alter table public.${table} enable row level security;`));

if (missingRls.length) {
  throw new Error(`RLS manquante : ${missingRls.join(', ')}`);
}

const requirements = [
  [core.includes('references auth.users'), 'Supabase Auth doit être la source des identités'],
  [core.includes('accept_invited_signup'), 'L’inscription doit consommer une invitation'],
  [core.includes('consent_records'), 'Les consentements doivent être versionnés'],
  [rls.includes('complete_beta_activation'), 'L’activation doit vérifier les consentements'],
  [rls.includes('is_conversation_member'), 'Les conversations doivent être isolées'],
  [rls.includes('album_access_grants'), 'Les accès aux albums doivent être contrôlés'],
  [storage.includes("'velvet-media'") && storage.includes('public=false'), 'Le bucket média doit rester privé'],
  [inviteFix.includes('extensions.crypt'), 'Le déclencheur doit utiliser le schéma Supabase des extensions'],
  [grants.includes('revoke all on all tables in schema public from anon'), 'Le rôle anonyme ne doit lire aucune table métier'],
  [grants.includes('grant select on public.accounts to authenticated'), 'Le compte authentifié doit pouvoir lire sa fiche sous RLS'],
  [grants.includes('grant select, insert on public.consent_records to authenticated'), 'Les consentements doivent être enregistrables après connexion'],
  [grants.includes('revoke all on public.beta_invites from anon, authenticated'), 'La liste des invitations doit rester côté serveur'],
  [neutralBeta.includes('upsert_my_beta_profile'), 'La création du premier profil doit être atomique'],
  [neutralBeta.includes('is_demo = false'), 'Le parcours réel ne doit jamais créer de profil fictif'],
  [neutralBeta.includes('organizer_requests_self_create'), 'Une demande Organisateur doit être protégée par RLS'],
  [neutralBeta.includes("not public.has_role('admin')"), 'La création des invitations doit être réservée aux administrateurs'],
  [sharedCouple.includes('invite_my_couple_partner'), 'Le rattachement du second partenaire doit utiliser une invitation dédiée'],
  [sharedCouple.includes("member_slot = 'partner_b'"), 'L’invitation partenaire doit cibler la seconde place du couple'],
  [sharedCouple.includes('linked_user_id = auth.uid()'), 'Chaque fiche personnelle doit rester liée à son propriétaire'],
  [sharedCouple.includes('revoke update on public.profile_members from authenticated'), 'Un partenaire ne doit pas modifier les appartenances du couple'],
  [memberOnboarding.includes('gender_identity'), 'La fiche personnelle doit enregistrer l’identité de genre'],
  [memberOnboarding.includes("values (auth.uid(),'member')"), 'L’activation doit provisionner le socle Membre'],
  [memberOnboarding.includes("select user_id,'member'"), 'Les comptes BETA existants doivent recevoir le socle Membre'],
  [photoAdmission.includes("required_portraits := case when profile_kind='couple' then 2 else 0 end"), 'Un profil individuel ne doit pas exiger de portrait supplémentaire'],
  [photoAdmission.includes('approved_gallery >= 3'), 'Trois photos publiques validées doivent être requises'],
  [!photoAdmission.includes('profile_gallery_limit_reached'), 'Le minimum d’admission ne doit pas devenir un plafond de galerie'],
  [photoAdmission.includes('record_photo_ai_decision'), 'La décision IA doit passer par une fonction serveur signée'],
  [photoAdmission.includes('extensions.hmac'), 'La décision IA doit être protégée par HMAC'],
  [photoAdmission.includes('is_admitted_member'), 'Les contacts doivent être bloqués avant admission'],
  [photoAdmission.includes("'public',") && photoAdmission.includes('albums_confidentiality_check'), 'Les albums publics doivent être distingués des albums privés'],
  [photoAdmission.includes('grant_private_album_to_profile'), 'Les accès privés temporaires doivent être accordés côté serveur'],
  [photoAdmission.includes('duration_hours not in (1,2,4,8,12,24)'), 'Les durées privées autorisées doivent être bornées'],
  [photoAdmission.includes('revoke_private_album_from_profile'), 'Un accès privé permanent doit rester révocable'],
  [photoAdmission.includes('venue_directory') && photoAdmission.includes('enable row level security'), 'Le référentiel des lieux doit être protégé par RLS'],
  [memberPreferences.includes('profile_privacy_settings') && memberPreferences.includes('profile_accepts_audience'), 'Les préférences de visibilité doivent être appliquées côté serveur'],
  [memberPreferences.includes('can_contact_user') && memberPreferences.includes('conversation_members_create'), 'Les préférences de contact doivent protéger les nouvelles conversations'],
  [memberPreferences.includes('member_notification_settings'), 'Les préférences de notification doivent être persistantes'],
  [memberPreferences.includes('browser_push_subscriptions') && memberPreferences.includes('browser_push_self_read'), 'Les abonnements navigateur doivent être isolés par utilisateur'],
  [stagedCouple.includes('create_my_couple_profile'), 'La fiche commune doit pouvoir être créée avant les fiches personnelles'],
  [stagedCouple.includes("'partner_required'"), 'Le couple incomplet doit rester dans le sas partenaire'],
  [stagedCouple.includes('record_couple_invitation_delivery'), 'La livraison de l’invitation doit être auditée côté serveur'],
  [stagedCouple.includes("member_slot_value<>'partner_a'"), 'Seul le créateur du couple peut initialiser la fiche commune'],
  [locationVerification.includes('member_location_settings') && locationVerification.includes('latitude_bucket'), 'La localisation doit être facultative et approximative'],
  [locationVerification.includes('exacte') && !locationVerification.includes('precise_location_value'), 'La migration ne doit pas créer de stockage GPS exact'],
  [locationVerification.includes('account_identity_age_verifications'), 'Le socle identité et majorité doit être distinct des profils publics'],
  [locationVerification.includes('identity_verified') && locationVerification.includes('majority_verified'), 'Le badge doit exiger identité et majorité'],
  [locationVerification.includes('external_verification_sessions'), 'Le branchement du prestataire tiers doit être préparé'],
  [locationVerification.includes("status <> 'verified' or (identity_verified and majority_verified)"), 'Un statut vérifié ne doit jamais être attribué partiellement'],
  [memberEngagement.includes('profile_view_history') && memberEngagement.includes('viewer_user_id=auth.uid()'), 'La mémoire de consultation doit rester propre à son auteur'],
  [memberEngagement.includes('profile_reactions') && memberEngagement.includes('reactor_user_id=auth.uid()'), 'Un membre doit contrôler uniquement son propre ressenti'],
  [memberEngagement.includes('public.is_profile_member(reactor_profile_id)'), 'Les ressentis doivent pouvoir être comparés uniquement au sein du couple auteur'],
  [!memberEngagement.includes('public.is_profile_member(target_profile_id)'), 'Le profil évalué ne doit jamais pouvoir lire le ressenti reçu'],
  [memberEngagement.includes('reaction in (-1,1,2,3)'), 'Les quatre niveaux de ressenti doivent être bornés en base'],
  [memberEngagement.includes('count(distinct m.sender_user_id) >= 2') && memberEngagement.includes('count(distinct pm.profile_id) >= 2'), 'Une journée de série doit exiger un échange entre deux personnes et deux profils distincts'],
  [memberEngagement.includes("time zone 'Europe/Paris'"), 'Les séries de conversation doivent utiliser la journée locale française'],
  [photoInteractions.includes("reaction in ('like','love','adore')"), 'Les réactions photo doivent être bornées à trois niveaux'],
  [photoInteractions.includes('public.can_access_media') && photoInteractions.includes("a.confidentiality='public'"), 'Les réactions doivent respecter la visibilité publique des albums'],
  [photoInteractions.includes('album_access_grants') && photoInteractions.includes('g.expires_at>now()'), 'Un album privé expiré ne doit plus exposer ses réactions'],
  [photoInteractions.includes('cannot_react_to_own_photo'), 'Un profil ne doit pas pouvoir réagir à ses propres photos'],
  [photoInteractions.includes('photo_reaction_summaries') && photoInteractions.includes('count(pr.media_id)'), 'Les membres doivent recevoir uniquement les compteurs agrégés'],
  [photoInteractions.includes('admin_list_beta_invites') && photoInteractions.includes("public.has_role('admin')"), 'L’historique des invitations doit rester réservé aux administrateurs'],
  [memberActions.includes('start_direct_profile_conversation') && memberActions.includes('direct_conversation_profiles'), 'La conversation directe doit être créée par une fonction transactionnelle dédiée'],
  [memberActions.includes('profile_privacy_settings') && memberActions.includes('contactable_by'), 'La création d’une conversation doit respecter les préférences de contact'],
  [memberActions.includes('public.blocks'), 'La création d’une conversation doit respecter les blocages'],
  [memberActions.includes('register_for_event') && memberActions.includes('for update'), 'Les places d’une sortie doivent être attribuées sous verrou transactionnel'],
  [memberActions.includes('is_registered_for_event') && memberActions.includes('registrations_participant_read'), 'Les participants visibles doivent être protégés sans récursion RLS'],
  [memberNotifications.includes('member_notifications') && memberNotifications.includes('member_notifications_self_read'), 'Le centre de notifications doit être isolé par utilisateur'],
  [memberNotifications.includes('member_notification_allowed') && memberNotifications.includes('member_notification_settings'), 'Les événements doivent respecter les préférences de notification'],
  [memberNotifications.includes('messages_create_notification') && memberNotifications.includes('photo_reactions_create_notification'), 'Messages et réactions photo doivent produire des notifications réelles'],
  [memberNotifications.includes('album_access_create_notification') && memberNotifications.includes('event_registrations_create_notification'), 'Albums privés et sorties doivent produire des notifications réelles'],
  [proWorkspace.includes('establishment_drafts') && proWorkspace.includes('establishment_drafts_staff'), 'Les brouillons Pro doivent être persistants et isolés par établissement'],
  [proWorkspace.includes('pro_workspace_participants') && proWorkspace.includes('is_venue_staff'), 'Le CRM Pro ne doit exposer que les participants de ses établissements'],
  [proWorkspace.includes('price_cents') && proWorkspace.includes('registration_open'), 'Les soirées Pro doivent posséder leurs données opérationnelles'],
  [!migrationBundle.includes('service_role'), 'Aucune clé ou dépendance service_role ne doit être intégrée aux migrations client']
];

for (const [valid, message] of requirements) {
  if (!valid) throw new Error(message);
}

console.log(`Supabase security checks passed: ${tables.length} tables protégées par RLS`);
