import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const inline = await readFile('apps/beta/static/assets/velvet-studio-ai-module.js', 'utf8');
const build = await readFile('apps/beta/scripts/build.mjs', 'utf8');
const voice = await readFile('functions/api/control/studio-media-safe.js', 'utf8');

test('Velvet Studio ajoute l’IA dans la page existante', () => {
  assert.doesNotThrow(() => new Function(inline));
  assert.match(inline, /Assistant IA Velvet/);
  assert.match(inline, /\.vs1-project-main/);
  assert.match(inline, /hero\.insertAdjacentElement\('afterend'/);
  assert.match(inline, /data-vsai-generate/);
  assert.match(inline, /data-vsai-create-project/);
});

test('le module intégré ne fabrique aucune surface de capture automatique', () => {
  assert.doesNotMatch(inline, /getDisplayMedia/);
  assert.doesNotMatch(inline, /MediaRecorder/);
  assert.doesNotMatch(inline, /captureStream/);
  assert.doesNotMatch(inline, /<iframe/);
  assert.doesNotMatch(inline, /MutationObserver/);
  assert.match(inline, /AbortController/);
});

test('Control charge uniquement le Studio historique et son module IA stable', () => {
  assert.match(build, /velvet-studio-sprint1\.js/);
  assert.match(build, /velvet-studio-ai-module\.js/);
  assert.doesNotMatch(build, /velvet-studio-live-recorder\.js/);
  assert.doesNotMatch(build, /velvet-studio-story-director\.js/);
  assert.doesNotMatch(build, /velvet-studio-lite\.js/);
  assert.doesNotMatch(build, /velvet-studio-product-demo\.js/);
});

test('la voix off reste française et ne bascule jamais vers Aura anglais', () => {
  assert.match(voice, /@cf\/myshell-ai\/melotts/);
  assert.match(voice, /lang:\s*'fr'/);
  assert.match(voice, /x-velvet-studio-voice-language': 'fr'/);
  assert.match(voice, /workers_ai_french_voice_unavailable/);
  assert.doesNotMatch(voice, /deepgram/);
  assert.doesNotMatch(voice, /aura/i);
});
