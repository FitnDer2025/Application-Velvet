import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const inline = await readFile('apps/beta/static/assets/velvet-studio-ai-module.js', 'utf8');
const capture = await readFile('apps/beta/static/assets/velvet-studio-capture.js', 'utf8');
const build = await readFile('apps/beta/scripts/build.mjs', 'utf8');
const voice = await readFile('functions/api/control/studio-media-safe.js', 'utf8');

test('Zwit Studio ajoute le module social dans la page existante', () => {
  assert.doesNotThrow(() => new Function(inline));
  assert.match(inline, /Vidéos sociales Velvet/);
  assert.match(inline, /Promouvoir Zwit Membre/);
  assert.match(inline, /Promouvoir Zwit Pro/);
  assert.match(inline, /\.vs1-project-main/);
  assert.match(inline, /hero\.insertAdjacentElement\('afterend'/);
  assert.match(inline, /data-vss-generate/);
  assert.match(inline, /data-vss-shoot/);
});

test('le module intégré garde la capture lourde dans une page séparée', () => {
  assert.doesNotMatch(inline, /getDisplayMedia/);
  assert.doesNotMatch(inline, /MediaRecorder/);
  assert.doesNotMatch(inline, /captureStream\(30\)/);
  assert.doesNotMatch(inline, /<iframe/);
  assert.match(inline, /new MutationObserver\(scheduleInstall\)/);
  assert.match(inline, /AbortController/);
  assert.match(capture, /getDisplayMedia/);
  assert.match(capture, /MediaRecorder/);
  assert.match(capture, /canvas\.captureStream\(30\)/);
});

test('Control charge uniquement le Studio historique et son module social stable', () => {
  assert.match(build, /velvet-studio-sprint1\.js/);
  assert.match(build, /velvet-studio-ai-module\.js/);
  assert.match(build, /studio-capture\/index\.html/);
  assert.doesNotMatch(build, /velvet-studio-live-recorder\.js/);
  assert.doesNotMatch(build, /velvet-studio-story-director\.js/);
  assert.doesNotMatch(build, /velvet-studio-lite\.js/);
  assert.doesNotMatch(build, /velvet-studio-product-demo\.js/);
});

test('le parcours final annonce une voix française du navigateur sans secours anglais', () => {
  assert.match(voice, /voiceEngine: 'browser-speech-fr'/);
  assert.match(voice, /generatedImages: false/);
  assert.match(inline, /SpeechSynthesisUtterance/);
  assert.match(inline, /\^fr\(\?:-\|_\)/);
  assert.doesNotMatch(inline, /deepgram|aura|generate_voice/i);
});
