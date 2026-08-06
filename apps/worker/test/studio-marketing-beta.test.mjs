import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const member = await readFile('apps/beta/static/assets/velvet-marketing-mode.js', 'utf8');
const pro = await readFile('apps/beta/static/assets/velvet-marketing-pro-mode.js', 'utf8');
const moduleSource = await readFile('apps/beta/static/assets/velvet-studio-ai-module.js', 'utf8');
const capture = await readFile('apps/beta/static/assets/velvet-studio-capture.js', 'utf8');
const portraits = await readFile('functions/api/control/marketing-portrait.js', 'utf8');
const build = await readFile('apps/beta/scripts/build.mjs', 'utf8');
const worker = await readFile('apps/beta/worker/index.js', 'utf8');

test('Zwit Marketing Membre utilise le vrai shell avec des données fictives', () => {
  assert.doesNotThrow(() => new Function(member));
  assert.match(member, /\.app-shell/);
  assert.match(member, /members\/directory/);
  assert.match(member, /BETA MARKETING · PROFILS FICTIFS/);
  assert.match(member, /data-vc-view/);
  assert.match(member, /Données fictives · environnement marketing/);
  assert.doesNotMatch(member, /Données réelles Supabase/);
});

test('Zwit Marketing Pro utilise le vrai shell avec son activité fictive', () => {
  assert.doesNotThrow(() => new Function(pro));
  assert.match(pro, /\/api\/pro\/workspace/);
  assert.match(pro, /BETA MARKETING PRO · DONNÉES FICTIVES/);
  assert.match(pro, /data-vp-view/);
  assert.match(pro, /Maison Zwit Lille/);
  assert.match(pro, /registrations/);
  assert.match(pro, /subscription_status: 'active'/);
});

test('le build publie les deux accès Marketing directement dans le module', () => {
  assert.match(build, /marketing\/index\.html/);
  assert.match(build, /marketing-pro\/index\.html/);
  assert.match(build, /velvet-marketing-mode\.js/);
  assert.match(build, /velvet-marketing-pro-mode\.js/);
  assert.doesNotMatch(build, /velvet-marketing-shortcut\.js/);
  assert.match(moduleSource, /Zwit Marketing Membre/);
  assert.match(moduleSource, /Zwit Marketing Pro/);
  assert.match(worker, /'\/marketing'/);
  assert.match(worker, /'\/marketing-pro'/);
});

test('la voix finale est choisie en français avant le tournage', () => {
  assert.match(moduleSource, /getVoices/);
  assert.match(moduleSource, /SpeechSynthesisUtterance/);
  assert.match(moduleSource, /femaleScore/);
  assert.match(moduleSource, /\^fr\(\?:-\|_\)/);
  assert.match(capture, /loadVoices/);
  assert.match(capture, /utterance\.lang = state\.voice\.lang \|\| 'fr-FR'/);
  assert.doesNotMatch(moduleSource, /generate_voice|melotts|aura/i);
});

test('les portraits Membre restent fictifs, contrôlés et mis en cache', () => {
  assert.match(portraits, /Fictional adults only|fictional adults only/);
  assert.match(portraits, /requireControl/);
  assert.match(portraits, /caches\.default/);
  assert.match(portraits, /@cf\/black-forest-labs\/flux-1-schnell/);
  assert.doesNotMatch(portraits, /api\.openai\.com/);
});
