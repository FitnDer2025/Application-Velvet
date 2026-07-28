import { readFile } from 'node:fs/promises';

const core = await readFile('infra/supabase/migrations/0001_velvet_beta_core.sql', 'utf8');
const rls = await readFile('infra/supabase/migrations/0002_velvet_beta_rls.sql', 'utf8');
const storage = await readFile('infra/supabase/migrations/0003_velvet_beta_storage.sql', 'utf8');

const tables = [...core.matchAll(/create table public\.([a-z_]+)/gi)].map((match) => match[1]);
const missingRls = tables.filter((table) => !rls.includes(`alter table public.${table} enable row level security;`));

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
  [!`${core}${rls}${storage}`.includes('service_role'), 'Aucune clé ou dépendance service_role ne doit être intégrée aux migrations client']
];

for (const [valid, message] of requirements) {
  if (!valid) throw new Error(message);
}

console.log(`Supabase security checks passed: ${tables.length} tables protégées par RLS`);

