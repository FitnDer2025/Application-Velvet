import { readFile } from 'node:fs/promises';

const core = await readFile('infra/supabase/migrations/0001_velvet_beta_core.sql', 'utf8');
const rls = await readFile('infra/supabase/migrations/0002_velvet_beta_rls.sql', 'utf8');
const storage = await readFile('infra/supabase/migrations/0003_velvet_beta_storage.sql', 'utf8');
const inviteFix = await readFile('infra/supabase/migrations/0004_fix_invite_crypto_schema.sql', 'utf8');
const grants = await readFile('infra/supabase/migrations/0005_authenticated_api_grants.sql', 'utf8');
const neutralBeta = await readFile('infra/supabase/migrations/0006_neutral_beta_profiles.sql', 'utf8');
const sharedCouple = await readFile('infra/supabase/migrations/0007_shared_couple_ownership.sql', 'utf8');

const tables = [...`${core}\n${neutralBeta}\n${sharedCouple}`.matchAll(/create table(?: if not exists)? public\.([a-z_]+)/gi)].map((match) => match[1]);
const rlsSources = `${rls}\n${neutralBeta}\n${sharedCouple}`;
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
  [!`${core}${rls}${storage}${inviteFix}${grants}${neutralBeta}${sharedCouple}`.includes('service_role'), 'Aucune clé ou dépendance service_role ne doit être intégrée aux migrations client']
];

for (const [valid, message] of requirements) {
  if (!valid) throw new Error(message);
}

console.log(`Supabase security checks passed: ${tables.length} tables protégées par RLS`);
