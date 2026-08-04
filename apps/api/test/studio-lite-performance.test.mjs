import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const clientUrl = new URL('../../beta/static/assets/velvet-studio-ai-module.js', import.meta.url);
const buildUrl = new URL('../../beta/scripts/build.mjs', import.meta.url);

test('le module IA compile et borne toutes les opérations réseau', async () => {
  const source = await readFile(clientUrl, 'utf8');
  assert.doesNotThrow(() => new Function(source));
  assert.match(source, /AbortController/);
  assert.match(source, /35_000/);
  assert.match(source, /clearTimeout\(timer\)/);
  assert.match(source, /attempts >= 100/);
});

test('Control charge uniquement le Studio existant et son module IA léger', async () => {
  const source = await readFile(buildUrl, 'utf8');
  assert.match(source, /velvet-studio-sprint1\.js/);
  assert.match(source, /velvet-studio-ai-module\.js/);
  assert.doesNotMatch(source, /velvet-studio-live-recorder\.js/);
  assert.doesNotMatch(source, /velvet-studio-story-director\.js/);
  assert.doesNotMatch(source, /velvet-studio-lite\.js/);
  assert.doesNotMatch(source, /velvet-studio-v2\.js/);
  assert.doesNotMatch(source, /velvet-studio-v3\.js/);
  assert.doesNotMatch(source, /velvet-studio-v31-media\.js/);
  assert.doesNotMatch(source, /velvet-studio-product-demo\.js/);
});

test('le module IA ne crée aucune boucle de rendu ni surface noire', async () => {
  const source = await readFile(clientUrl, 'utf8');
  assert.doesNotMatch(source, /requestAnimationFrame\(paintFrame\)/);
  assert.doesNotMatch(source, /getDisplayMedia|MediaRecorder|captureStream/);
  assert.doesNotMatch(source, /MutationObserver/);
  assert.doesNotMatch(source, /position:fixed;inset:0;z-index:120000/);
  assert.doesNotMatch(source, /<iframe/);
});
