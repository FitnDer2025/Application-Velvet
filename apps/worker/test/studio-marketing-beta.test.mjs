import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const marketing = await readFile('apps/beta/static/assets/velvet-marketing-mode.js', 'utf8');
const capture = await readFile('apps/beta/static/assets/velvet-capture-mode.js', 'utf8');
const shortcut = await readFile('apps/beta/static/assets/velvet-marketing-shortcut.js', 'utf8');
const voice = await readFile('functions/api/control/studio-media-safe.js', 'utf8');
const portraits = await readFile('functions/api/control/marketing-portrait.js', 'utf8');
const build = await readFile('apps/beta/scripts/build.mjs', 'utf8');
const worker = await readFile('apps/beta/worker/index.js', 'utf8');
const voiceModule = await import('../../../functions/api/control/studio-media-safe.js');

test('la BETA Marketing utilise le vrai shell Membres avec des données fictives', () => {
  assert.doesNotThrow(() => new Function(marketing));
  assert.match(marketing, /\.app-shell/);
  assert.match(marketing, /members\/directory/);
  assert.match(marketing, /BETA MARKETING · PROFILS FICTIFS/);
  assert.match(marketing, /data-vc-view/);
  assert.match(marketing, /Données fictives · environnement marketing/);
  assert.doesNotMatch(marketing, /Données réelles Supabase/);
});

test('les captures Studio sont redirigées vers le vrai environnement marketing', () => {
  assert.doesNotThrow(() => new Function(capture));
  assert.match(capture, /\/marketing\//);
  assert.match(capture, /velvet_capture/);
  assert.doesNotMatch(capture, /document\.body\.innerHTML/);
});

test('le build publie un accès marketing isolé et son raccourci Control', () => {
  assert.doesNotThrow(() => new Function(shortcut));
  assert.match(build, /marketing\/index\.html/);
  assert.match(build, /velvet-marketing-mode\.js/);
  assert.match(build, /velvet-marketing-shortcut\.js/);
  assert.match(worker, /'\/marketing'/);
  assert.match(worker, /GET \/api\/control\/marketing-portrait/);
});

test('la voix off est exclusivement française', () => {
  assert.equal(typeof voiceModule.onRequestPost, 'function');
  assert.match(voice, /cleanFrenchSpeech/);
  assert.match(voice, /frenchFallback/);
  assert.match(voice, /@cf\/myshell-ai\/melotts/);
  assert.match(voice, /lang:\s*'fr'/);
  assert.match(voice, /workers_ai_french_voice_unavailable/);
  assert.match(voice, /x-velvet-studio-voice-language/);
  assert.doesNotMatch(voice, /deepgram|aura/i);
  assert.match(worker, /studio-media-safe\.js/);
});

test('les portraits marketing sont fictifs, contrôlés et mis en cache', () => {
  assert.match(portraits, /Fictional adults only|fictional adults only/);
  assert.match(portraits, /requireControl/);
  assert.match(portraits, /caches\.default/);
  assert.match(portraits, /@cf\/black-forest-labs\/flux-1-schnell/);
  assert.doesNotMatch(portraits, /api\.openai\.com/);
});
