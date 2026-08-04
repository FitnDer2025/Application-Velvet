import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const recorder = await readFile('apps/beta/static/assets/velvet-studio-live-recorder.js', 'utf8');
const build = await readFile('apps/beta/scripts/build.mjs', 'utf8');
const voice = await readFile('functions/api/control/studio-media-safe.js', 'utf8');

test('Velvet Studio enregistre une navigation réelle de la BETA Marketing', () => {
  assert.doesNotThrow(() => new Function(recorder));
  assert.match(recorder, /getDisplayMedia/);
  assert.match(recorder, /MediaRecorder/);
  assert.match(recorder, /\/marketing\/\?velvet_capture=/);
  assert.match(recorder, /navigateScene/);
  assert.match(recorder, /visibleClick/);
  assert.match(recorder, /data-open-profile/);
  assert.match(recorder, /data-open-conversation/);
});

test('le moteur live ne fabrique plus une vidéo à partir de captures fixes', () => {
  assert.doesNotMatch(recorder, /domToImage/);
  assert.doesNotMatch(recorder, /fallbackScreen/);
  assert.doesNotMatch(recorder, /toDataURL/);
  assert.match(recorder, /displayVideo/);
  assert.match(recorder, /canvasStream/);
});

test('Control charge uniquement le nouveau Studio live', () => {
  assert.match(build, /velvet-studio-live-recorder\.js/);
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
