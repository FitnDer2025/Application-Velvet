import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const marketing = await readFile('apps/beta/static/assets/velvet-marketing-pro-mode.js', 'utf8');
const bridge = await readFile('apps/beta/static/assets/velvet-marketing-pro-studio-bridge.js', 'utf8');
const studio = await readFile('apps/beta/static/assets/velvet-pro-studio-ai.js', 'utf8');
const build = await readFile('apps/beta/scripts/build.mjs', 'utf8');

test('Zwit Pro Marketing charge le pont Studio IA', () => {
  assert.doesNotThrow(() => new Function(marketing));
  assert.doesNotThrow(() => new Function(bridge));
  assert.match(marketing, /velvet-marketing-pro-studio-bridge\.js/);
  assert.match(build, /velvet-pro-studio-ai\.js/);
  assert.match(build, /marketing-pro\/index\.html/);
});

test('le Studio Marketing utilise un établissement fictif isolé', () => {
  assert.match(bridge, /72000000-0000-4000-8000-000000000001/);
  assert.match(bridge, /Maison Zwit Lille/);
  assert.match(bridge, /velvet_marketing_pro_studio_demo_v1/);
  assert.match(bridge, /marketingMode:\s*true/);
  assert.doesNotMatch(bridge, /SUPABASE_SERVICE_ROLE_KEY|\/rest\/v1\/pro_studio_/);
});

test('les données fixes de marque sont préconfigurées', () => {
  assert.match(bridge, /primary_color:\s*'#7D294C'/);
  assert.match(bridge, /accent_color:\s*'#D5B477'/);
  assert.match(bridge, /logoUrl:\s*logoSvg/);
  assert.match(bridge, /fixed_information/);
  assert.match(bridge, /recurring_features/);
});

test('le décor est réellement généré par Workers AI via Control', () => {
  assert.match(bridge, /\/api\/control\/studio-media/);
  assert.match(bridge, /action:\s*'generate_image'/);
  assert.match(bridge, /Strictly no text|No text|no text/i);
  assert.match(bridge, /@cf\/black-forest-labs\/flux-1-schnell/);
});

test('la bibliothèque, les uploads et les rendus sont simulés sans toucher aux professionnels réels', () => {
  assert.match(bridge, /save_brand_kit/);
  assert.match(bridge, /save_project/);
  assert.match(bridge, /delete_project/);
  assert.match(bridge, /upload_asset/);
  assert.match(bridge, /save_render/);
  assert.match(bridge, /imageDataUrl/);
  assert.match(bridge, /transientRenders/);
});

test('le Studio complet V1 V2 V3 reste utilisé dans Pro Marketing', () => {
  assert.match(studio, /V1 · Affiches HD/);
  assert.match(studio, /V2 · Kits multi-formats/);
  assert.match(studio, /V3 · Affiches animées/);
  assert.match(studio, /Créer une affiche/);
  assert.match(studio, /Bibliothèque/);
  assert.match(studio, /Identité visuelle/);
});
