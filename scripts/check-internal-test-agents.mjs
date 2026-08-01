import { readFile } from 'node:fs/promises';

const migration = await readFile(
  'infra/supabase/migrations/0027_internal_ai_test_agents.sql',
  'utf8'
);
const endpoint = await readFile('functions/api/control/test-agents.js', 'utf8');
const runtime = await readFile('apps/worker/src/test-agents.mjs', 'utf8');

const requirements = [
  [migration.includes('is_internal_test_agent boolean not null default false'), 'Le profil doit porter un marqueur interne'],
  [migration.includes('internal_test_agent_viewers'), 'Une liste blanche interne doit exister'],
  [migration.includes('is_internal_test_cohort_profile'), 'La cohorte doit être contrôlée côté serveur'],
  [migration.includes('internal_test_agents_present'), 'La publication doit être bloquée tant que des agents existent'],
  [migration.includes('internal_purge_test_agent'), 'Une suppression serveur doit être disponible'],
  [migration.includes('enable row level security'), 'Les tables internes doivent activer la RLS'],
  [endpoint.includes("name === 'production'"), 'L’API doit refuser la production'],
  [endpoint.includes('SUPABASE_SERVICE_ROLE_KEY'), 'La création doit utiliser une clé serveur'],
  [endpoint.includes("body.action === 'cleanup'"), 'L’API doit exposer le nettoyage'],
  [runtime.includes("VELVET_INTERNAL_TEST_AGENTS || '') === 'enabled'"), 'Le worker doit exiger le drapeau explicite'],
  [runtime.includes('target_profile.is_internal_test_agent'), 'Les réponses doivent rester dans la cohorte'],
  [runtime.includes('internal_test_agent_runs'), 'Les actions doivent être auditées sans contenu intime']
];

const missing = requirements.filter(([valid]) => !valid).map(([, message]) => message);
if (missing.length) {
  throw new Error(`Contrôles agents IA internes manquants : ${missing.join(' ; ')}`);
}

console.log('Contrôles agents IA internes : OK');
