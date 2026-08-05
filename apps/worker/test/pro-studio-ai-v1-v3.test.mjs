import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const client = await readFile('apps/beta/static/assets/velvet-pro-studio-ai.js', 'utf8');
const api = await readFile('functions/api/pro/studio-ai.js', 'utf8');
const migration = await readFile('infra/supabase/migrations/0043_pro_studio_ai.sql', 'utf8');
const worker = await readFile('apps/beta/worker/index.js', 'utf8');
const build = await readFile('apps/beta/scripts/build.mjs', 'utf8');

test('le Studio IA Pro compile et s’intègre dans le portail', () => {
  assert.doesNotThrow(() => new Function(client));
  assert.match(client, /Studio IA/);
  assert.match(client, /data-pro-studio-nav/);
  assert.match(client, /Identité visuelle/);
  assert.match(client, /Créer une affiche/);
  assert.match(build, /velvet-pro-studio-ai\.js/);
});

test('la V1 sépare le décor IA des textes et photos exacts', () => {
  assert.match(client, /composePoster/);
  assert.match(client, /exactTextLayer: true/);
  assert.match(client, /photosComposited/);
  assert.match(client, /drawDateCards/);
  assert.match(client, /drawInfoBox/);
  assert.match(api, /AUCUN texte, AUCUNE lettre, AUCUN chiffre et AUCUN logo/);
  assert.match(api, /Strictly no text, no typography, no letters, no numbers, no logo/);
});

test('la V2 propose bibliothèque duplication variantes et multi-formats', () => {
  for (const format of ["'9:16'", "'4:5'", "'1:1'", "'16:9'", 'a4']) assert.match(client, new RegExp(format.replace(':', '\\:')));
  assert.match(client, /Bibliothèque de créations/);
  assert.match(client, /data-duplicate-project/);
  assert.match(client, /creative_payload\.variants/);
  assert.match(client, /social_kit/);
  assert.match(api, /pro_studio_projects/);
  assert.match(api, /pro_studio_renders/);
});

test('la V3 produit une vraie vidéo animée depuis le canvas', () => {
  assert.match(client, /HTMLCanvasElement\.prototype\.captureStream/);
  assert.match(client, /new MediaRecorder/);
  assert.match(client, /video\/webm/);
  assert.match(client, /Créer le teaser vidéo/);
  assert.match(client, /requestAnimationFrame/);
});

test('le backend utilise uniquement Workers AI et protège l’accès Pro', () => {
  assert.match(api, /@cf\/black-forest-labs\/flux-1-schnell/);
  assert.match(api, /@cf\/zai-org\/glm-4\.7-flash/);
  assert.match(api, /pro_access_required/);
  assert.match(api, /allowedVenue/);
  assert.doesNotMatch(api, /api\.openai\.com|elevenlabs|midjourney/);
  assert.match(worker, /GET \/api\/pro\/studio-ai/);
  assert.match(worker, /POST \/api\/pro\/studio-ai/);
});

test('Supabase mémorise la charte les projets les médias et les rendus', () => {
  for (const table of ['pro_studio_brand_kits', 'pro_studio_projects', 'pro_studio_assets', 'pro_studio_renders', 'pro_studio_templates']) {
    assert.match(migration, new RegExp(`create table if not exists public\\.${table}`));
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
  }
  assert.match(migration, /velvet-pro-studio/);
  assert.match(migration, /can_manage_pro_studio/);
  assert.match(migration, /logo_storage_path/);
  assert.match(migration, /brand_prompt/);
});

test('le studio reste utilisable avant application de la migration', () => {
  assert.match(client, /migrationPending/);
  assert.match(client, /localStorage/);
  assert.match(client, /mémoire locale|mémoire locale/i);
  assert.match(api, /migrationMissing/);
});
