import { readFile } from 'node:fs/promises';

const migration = (await Promise.all([
  'infra/supabase/migrations/0027_internal_ai_test_agents_core.sql',
  'infra/supabase/migrations/0028_internal_ai_test_agents_operations.sql',
  'infra/supabase/migrations/0029_internal_ai_test_agents_release_guard.sql',
  'infra/supabase/migrations/0030_internal_ai_test_agents_hardening.sql',
  'infra/supabase/migrations/0031_internal_ai_test_agents_visibility_hardening.sql',
  'infra/supabase/migrations/0032_restore_authenticated_conversation_access.sql',
  'infra/supabase/migrations/0033_internal_test_agents_service_role_privileges.sql',
  'infra/supabase/migrations/0034_internal_test_agents_seed_service_privileges.sql'
].map((path) => readFile(path, 'utf8')))).join('\n');
const endpoint = await readFile('functions/api/control/test-agents.js', 'utf8');
const runtime = await readFile('apps/worker/src/test-agents.mjs', 'utf8');
const portraits = await readFile('functions/api/control/_test-agent-portraits.js', 'utf8');
const aiRuntime = await readFile('apps/worker/src/test-agent-ai.mjs', 'utf8');

const requirements = [
  [migration.includes('is_internal_test_agent boolean not null default false'), 'Le profil doit porter un marqueur interne'],
  [migration.includes('internal_test_agent_viewers'), 'Une liste blanche interne doit exister'],
  [migration.includes('is_internal_test_cohort_profile'), 'La cohorte doit être contrôlée côté serveur'],
  [migration.includes('create or replace function public.is_conversation_member'), 'La révocation d’un viewer doit couper les conversations existantes'],
  [migration.includes('grant execute on function public.is_conversation_member(uuid) to authenticated'), 'La messagerie membre doit conserver le droit d’évaluer ses politiques RLS'],
  [migration.includes('grant execute on function public.can_view_profile(uuid) to authenticated'), 'Les profils membres doivent rester accessibles après le durcissement interne'],
  [migration.includes('grant select, insert, update, delete') && migration.includes('to service_role'), 'Le serveur doit pouvoir gérer les tables IA internes'],
  [migration.includes('grant select on table public.accounts to service_role'), 'Le seed doit pouvoir retrouver un compte interne existant'],
  [migration.includes('on table public.media_assets') && migration.includes('grant insert on table public.audit_events to service_role'), 'Le seed doit pouvoir gérer ses médias et son audit'],
  [migration.includes('on delete set null'), 'Le nettoyage Auth doit rester relançable après suppression du profil'],
  [migration.includes('internal_test_agents_present'), 'La publication doit être bloquée tant que des agents existent'],
  [migration.includes('internal_purge_test_agent'), 'Une suppression serveur doit être disponible'],
  [migration.includes('enable row level security'), 'Les tables internes doivent activer la RLS'],
  [endpoint.includes("name === 'production'"), 'L’API doit refuser la production'],
  [endpoint.includes('SUPABASE_SERVICE_ROLE_KEY'), 'La création doit utiliser une clé serveur'],
  [endpoint.includes("body.action === 'cleanup'"), 'L’API doit exposer le nettoyage'],
  [endpoint.includes("accessMode: 'authenticated_internal'"), 'Le contrôle interne doit exiger une session authentifiée'],
  [endpoint.includes("'content-type': 'image/png'") && portraits.includes("chunk('IDAT'"), 'Les visuels de recette doivent respecter les types MIME autorisés'],
  [aiRuntime.includes("VELVET_INTERNAL_TEST_AGENTS || '') === 'enabled'"), 'Le worker doit exiger le drapeau explicite'],
  [aiRuntime.includes('store: false'), 'Les réponses IA ne doivent pas être stockées comme état fournisseur'],
  [aiRuntime.includes('instructions: IDENTITY_GUARD'), 'Les messages utilisateurs ne doivent pas pouvoir redéfinir l’identité des agents'],
  [runtime.includes('target_profile.is_internal_test_agent'), 'Les réponses doivent rester dans la cohorte'],
  [runtime.includes('internal_test_agent_runs'), 'Les actions doivent être auditées sans contenu intime']
];

const missing = requirements.filter(([valid]) => !valid).map(([, message]) => message);
if (missing.length) {
  throw new Error(`Contrôles agents IA internes manquants : ${missing.join(' ; ')}`);
}

console.log('Contrôles agents IA internes : OK');
