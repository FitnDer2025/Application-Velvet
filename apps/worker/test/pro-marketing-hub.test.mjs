import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const client = await readFile('apps/beta/static/assets/velvet-pro-marketing.js', 'utf8');
const runtime = await readFile('apps/beta/static/assets/velvet-pro-marketing-runtime.js', 'utf8');
const bridge = await readFile('apps/beta/static/assets/velvet-marketing-pro-campaign-bridge.js', 'utf8');
const accountMenu = await readFile('apps/beta/static/assets/account-access-menu.js', 'utf8');
const api = await readFile('functions/api/pro/marketing.js', 'utf8');
const migration = await readFile('infra/supabase/migrations/0044_pro_marketing_hub.sql', 'utf8');
const worker = await readFile('apps/beta/worker/index.js', 'utf8');
const wrangler = await readFile('apps/beta/wrangler.jsonc', 'utf8');
const setup = await readFile('docs/VELVET_PRO_MARKETING_SETUP.md', 'utf8');

test('le cockpit Velvet Marketing compile et reste dans le portail Pro', () => {
  assert.doesNotThrow(() => new Function(client));
  assert.doesNotThrow(() => new Function(runtime));
  assert.match(client, /VELVET PRO · CONCENTRATEUR MARKETING/);
  assert.match(client, /data-pro-marketing-nav/);
  assert.match(client, /Créer une campagne/);
  assert.match(client, /Calendrier éditorial/);
  assert.match(client, /Publications/);
  assert.match(client, /Résultats/);
  assert.match(client, /Connexions/);
  assert.match(accountMenu, /velvet-pro-marketing-runtime\.js/);
  assert.match(accountMenu, /velvet-pro-marketing\.js/);
});

test('le runtime garantit un onglet actif et des messages compréhensibles', () => {
  assert.match(runtime, /data-vpm-tab="create"/);
  assert.match(runtime, /marketing_preview_external_publish_disabled/);
  assert.match(runtime, /La diffusion externe s’active depuis le portail Pro/);
  assert.match(runtime, /response\.clone\(\)\.json/);
  assert.doesNotMatch(runtime, /META_APP_SECRET|TIKTOK_CLIENT_SECRET|SUPABASE_SERVICE_ROLE_KEY/);
});

test('la campagne part de l’agenda et d’un rendu réellement créé dans Studio', () => {
  assert.match(client, /snapshot\?\.events/);
  assert.match(client, /snapshot\?\.renders/);
  assert.match(client, /studio_project_id/);
  assert.match(client, /studio_render_id/);
  assert.match(client, /Sélectionnez une soirée et une affiche/);
  assert.match(api, /pro_studio_projects/);
  assert.match(api, /pro_studio_renders/);
  assert.match(api, /pro_marketing_campaigns/);
});

test('Velvet prépare Facebook Instagram TikTok et la séquence éditoriale', () => {
  for (const network of ['facebook', 'instagram', 'tiktok']) {
    assert.match(client, new RegExp(network));
    assert.match(api, new RegExp(network));
  }
  for (const milestone of ['j-21', 'j-10', 'j-3', 'jour-j']) assert.match(client, new RegExp(milestone));
  assert.match(client, /Rédiger avec Velvet IA/);
  assert.match(api, /@cf\/zai-org\/glm-4\.7-flash/);
  assert.match(api, /generateCopy/);
  assert.match(api, /conservativeCompliance/);
});

test('aucune publication ne part sans validation humaine et contrôle de conformité', () => {
  assert.match(client, /Je valide personnellement cette campagne/);
  assert.match(api, /marketing_human_approval_required/);
  assert.match(api, /marketing_compliance_blocking/);
  assert.match(api, /body\.approved !== true/);
  assert.match(api, /humanReviewRequired: true/);
  assert.doesNotMatch(client, /META_APP_SECRET|TIKTOK_CLIENT_SECRET|SUPABASE_SERVICE_ROLE_KEY|credentials_ciphertext|accessToken/);
});

test('les connexions sociales utilisent OAuth et des jetons chiffrés côté serveur', () => {
  assert.match(api, /AES-GCM/);
  assert.match(api, /SOCIAL_TOKEN_ENCRYPTION_KEY/);
  assert.match(api, /SOCIAL_OAUTH_STATE_SECRET/);
  assert.match(api, /pages_manage_posts/);
  assert.match(api, /instagram_content_publish/);
  assert.match(api, /video\.publish/);
  assert.match(api, /video\.upload/);
  assert.match(api, /oauth\/access_token/);
  assert.match(api, /open\.tiktokapis\.com/);
});

test('la publication directe conserve les statuts exacts renvoyés par les plateformes', () => {
  assert.match(api, /publishFacebook/);
  assert.match(api, /publishInstagram/);
  assert.match(api, /publishTikTok/);
  assert.match(api, /draft_delivered/);
  assert.match(api, /external_post_id/);
  assert.match(api, /external_publish_id/);
  assert.match(client, /n’affiche jamais une publication comme réussie sans confirmation/);
  assert.match(client, /Aucun chiffre n’est inventé/);
});

test('Supabase isole connexions campagnes publications métriques et audits par établissement', () => {
  const tables = [
    'pro_social_connections',
    'pro_marketing_campaigns',
    'pro_marketing_publications',
    'pro_marketing_metrics',
    'pro_marketing_audit_log'
  ];
  for (const table of tables) {
    assert.match(migration, new RegExp(`create table if not exists public\\.${table}`));
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
  }
  assert.match(migration, /can_manage_pro_studio\(establishment_id\)/);
  assert.match(migration, /credentials_ciphertext/);
  assert.match(migration, /approved_by/);
  assert.match(migration, /scheduled_at/);
});

test('le Worker route les API et exécute le planificateur Cloudflare', () => {
  assert.match(worker, /GET \/api\/pro\/marketing/);
  assert.match(worker, /POST \/api\/pro\/marketing/);
  assert.match(worker, /oauth\/meta\/start/);
  assert.match(worker, /oauth\/tiktok\/callback/);
  assert.match(worker, /processDuePublications/);
  assert.match(worker, /async scheduled/);
  assert.match(wrangler, /\*\/5 \* \* \* \*/);
  assert.match(api, /status: 'processing'/);
  assert.match(api, /attempts < 3/);
});

test('le média social reste privé et n’est exposé que par une signature courte durée', () => {
  assert.match(api, /publicMediaUrl/);
  assert.match(api, /SOCIAL_OAUTH_STATE_SECRET/);
  assert.match(api, /expires > Math\.floor/);
  assert.match(api, /timingSafeEqual/);
  assert.match(api, /velvet-pro-studio/);
  assert.match(api, /Lien expiré/);
});

test('l’aperçu Pro utilise le même cockpit sans prétendre publier réellement', () => {
  assert.doesNotThrow(() => new Function(bridge));
  assert.match(bridge, /marketing_preview_external_publish_disabled/);
  assert.match(bridge, /status: 'scheduled'/);
  assert.match(bridge, /previousFetch\('\/api\/pro\/workspace/);
  assert.match(bridge, /\/api\/pro\/studio-ai/);
  assert.match(accountMenu, /velvet-marketing-pro-campaign-bridge\.js/);
});

test('le guide exige les audits et garde tous les secrets hors de GitHub', () => {
  assert.match(setup, /META_APP_SECRET/);
  assert.match(setup, /TIKTOK_CLIENT_SECRET/);
  assert.match(setup, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(setup, /audit/);
  assert.match(setup, /ne jamais ajouter ces secrets dans GitHub/i);
  assert.doesNotMatch(setup, /sk_live_|eyJ[A-Za-z0-9_-]{20,}|EAA[A-Za-z0-9]{20,}/);
});
