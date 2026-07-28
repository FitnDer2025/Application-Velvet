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

const tables = [...`${core}\n${neutralBeta}\n${sharedCouple}\n${memberOnboarding}\n${photoAdmission}`.matchAll(/create table(?: if not exists)? public\.([a-z_]+)/gi)].map((match) => match[1]);
const rlsSources = `${rls}\n${neutralBeta}\n${sharedCouple}\n${memberOnboarding}\n${photoAdmission}`;
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
  [photoAdmission.includes("approved_gallery >= 3"), 'Trois photos publiques validées doivent être requises'],
  [!photoAdmission.includes('profile_gallery_limit_reached'), 'Le minimum d’admission ne doit pas devenir un plafond de galerie'],
  [photoAdmission.includes('record_photo_ai_decision'), 'La décision IA doit passer par une fonction serveur signée'],
  [photoAdmission.includes('extensions.hmac'), 'La décision IA doit être protégée par HMAC'],
  [photoAdmission.includes('is_admitted_member'), 'Les contacts doivent être bloqués avant admission'],
  [photoAdmission.includes("'public',") && photoAdmission.includes('albums_confidentiality_check'), 'Les albums publics doivent être distingués des albums privés'],
  [photoAdmission.includes('grant_private_album_to_profile'), 'Les accès privés temporaires doivent être accordés côté serveur'],
  [photoAdmission.includes('duration_hours not in (1,2,4,8,12,24)'), 'Les durées privées autorisées doivent être bornées'],
  [photoAdmission.includes('revoke_private_album_from_profile'), 'Un accès privé permanent doit rester révocable'],
  [photoAdmission.includes('venue_directory') && photoAdmission.includes('enable row level security'), 'Le référentiel des lieux doit être protégé par RLS'],
  [!`${core}${rls}${storage}${inviteFix}${grants}${neutralBeta}${sharedCouple}${memberOnboarding}${photoAdmission}`.includes('service_role'), 'Aucune clé ou dépendance service_role ne doit être intégrée aux migrations client']
];

for (const [valid, message] of requirements) {
  if (!valid) throw new Error(message);
}

console.log(`Supabase security checks passed: ${tables.length} tables protégées par RLS`);
