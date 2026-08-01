import { readFile } from 'node:fs/promises';

const migration = (await Promise.all([
  'infra/supabase/migrations/0027_internal_ai_test_agents_core.sql',
  'infra/supabase/migrations/0028_internal_ai_test_agents_operations.sql',
  'infra/supabase/migrations/0029_internal_ai_test_agents_release_guard.sql',
  'infra/supabase/migrations/0030_internal_ai_test_agents_hardening.sql'
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
  [migration.includes('on delete set null'), 'Le nettoyage Auth doit rester relançable après suppression du profil'],
  [migration.includes('internal_test_agents_present'), 'La publication doit être bloquée tant que des agents existent'],
  [migration.includes('internal_purge_test_agent'), 'Une suppression serveur doit être disponible'],
  [migration.includes('enable row level security'), 'Les tables internes doivent activer la RLS'],
  [endpoint.includes("name === 'production'"), 'L’API doit refuser la production'],
  [endpoint.includes('SUPABASE_SERVICE_ROLE_KEY'), 'La création doit utiliser une clé serveur'],
  [endpoint.includes("body.action === 'cleanup'"), 'L’API doit exposer le nettoyage'],
  [endpoint.includes("'content-type': 'image/png'") && portraits.includes("chunk('IDAT'"), 'Les visuels de recette doivent respecter les types MIME autorisés'],
  [aiRuntime.includes("VELVET_INTERNAL_TEST_AGENTS || '') === 'enabled'"), 'Le worker doit exiger le drapeau explicite'],
  [aiRuntime.includes('store: false'), 'Les réponses IA ne doivent pas être stockées comme état fournisseur'],
  [runtime.includes('target_profile.is_internal_test_agent'), 'Les réponses doivent rester dans la cohorte'],
  [runtime.includes('internal_test_agent_runs'), 'Les actions doivent être auditées sans contenu intime']
];

const missing = requirements.filter(([valid]) => !valid).map(([, message]) => message);
if (missing.length) {
  throw new Error(`Contrôles agents IA internes manquants : ${missing.join(' ; ')}`);
}

console.log('Contrôles agents IA internes : OK');
