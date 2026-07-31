import { readFile } from 'node:fs/promises';

const migration = await readFile(
  'infra/supabase/migrations/0027_privacy_security_dsa_compliance.sql',
  'utf8'
);
const privacyApi = await readFile('functions/api/members/privacy.js', 'utf8');
const mfaApi = await readFile('functions/api/control/mfa.js', 'utf8');
const complianceApi = await readFile('functions/api/control/compliance.js', 'utf8');
const illegalContentApi = await readFile('functions/api/legal/illegal-content.js', 'utf8');
const worker = await readFile('apps/worker/src/worker.mjs', 'utf8');
const privacyPage = await readFile('apps/beta/static/legal/privacy/index.html', 'utf8');
const safetyPage = await readFile('apps/beta/static/legal/safety/index.html', 'utf8');

const requirements = [
  [migration.includes('latest_consent_is_granted'), 'Le dernier choix de consentement doit être la source de vérité'],
  [migration.includes("privacy_mode in ('public', 'private', 'invisible')"), 'Les trois modes de visibilité doivent être bornés en base'],
  [migration.includes("current_authentication_assurance_level() = 'aal2'"), 'Control doit exiger un niveau AAL2'],
  [migration.includes('is_sensitive_data_reviewer'), 'Les contenus sensibles doivent avoir un périmètre de rôle réduit'],
  [migration.includes('data_subject_request_events'), 'Les demandes RGPD doivent avoir un historique'],
  [migration.includes('illegal_content_notices'), 'Le canal DSA doit être persisté'],
  [migration.includes('moderation_evidence') && migration.includes('snapshot_ciphertext'), 'Les preuves doivent accepter un instantané chiffré'],
  [migration.includes('moderation_actions') && migration.includes('statement_of_reasons'), 'Les décisions de modération doivent être motivées et tracées'],
  [migration.includes('moderation_appeals'), 'Un recours interne doit être enregistrable'],
  [migration.includes('personal_data_breaches') && migration.includes("interval '72 hours'"), 'Le registre de violation doit calculer l’échéance de 72 heures'],
  [migration.includes('data_retention_policies'), 'Les règles de conservation doivent être versionnables en base'],
  [migration.includes('storage_deletion_queue'), 'La suppression des médias doit être vérifiable'],
  [migration.includes('control_compliance_checks'), 'Control doit exposer des contrôles de conformité bloquants'],
  [privacyApi.includes('withdraw_consent') && privacyApi.includes('request_right'), 'Le membre doit pouvoir retirer un consentement et exercer ses droits'],
  [mfaApi.includes("action === 'enroll'") && mfaApi.includes("action === 'verify'"), 'Le parcours TOTP doit couvrir enrôlement et vérification'],
  [complianceApi.includes('decide_report') && complianceApi.includes('declare_breach'), 'Control doit traiter les décisions et violations'],
  [illegalContentApi.includes('submit_illegal_content_notice'), 'Le point de contact DSA doit fonctionner sans compte'],
  [worker.includes('storage_deletion_queue') && worker.includes("status='completed'"), 'Le worker doit confirmer l’effacement physique'],
  [privacyPage.includes('Ouverture conditionnelle'), 'Les mentions légales ne doivent pas prétendre que les validations restantes sont terminées'],
  [safetyPage.includes('Comportements interdits') && safetyPage.includes('Décision et recours'), 'Les règles de modération et le recours doivent être publiés']
];

const missing = requirements.filter(([passed]) => !passed).map(([, message]) => message);
if (missing.length) {
  throw new Error(`Fondation conformité incomplète :\n- ${missing.join('\n- ')}`);
}

console.log(`Fondation conformité validée : ${requirements.length} contrôles.`);
