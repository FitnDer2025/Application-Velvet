import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const clientUrl = new URL('../../beta/static/assets/velvet-studio-ai-module.js', import.meta.url);
const captureUrl = new URL('../../beta/static/assets/velvet-studio-capture.js', import.meta.url);
const buildUrl = new URL('../../beta/scripts/build.mjs', import.meta.url);

test('le module Studio compile et borne ses appels réseau', async () => {
  const source = await readFile(clientUrl, 'utf8');
  assert.doesNotThrow(() => new Function(source));
  assert.match(source, /AbortController/);
  assert.match(source, /40_000/);
  assert.match(source, /clearTimeout\(timer\)/);
  assert.match(source, /requestAnimationFrame/);
});

test('Control charge uniquement le Studio existant et le module social', async () => {
  const source = await readFile(buildUrl, 'utf8');
  assert.match(source, /velvet-studio-sprint1\.js/);
  assert.match(source, /velvet-studio-ai-module\.js/);
  assert.match(source, /velvet-control-scroll-recovery\.js/);
  assert.doesNotMatch(source, /velvet-studio-live-recorder\.js/);
  assert.doesNotMatch(source, /velvet-studio-story-director\.js/);
  assert.doesNotMatch(source, /velvet-studio-lite\.js/);
  assert.doesNotMatch(source, /velvet-studio-v2\.js/);
  assert.doesNotMatch(source, /velvet-studio-v3\.js/);
  assert.doesNotMatch(source, /velvet-studio-v31-media\.js/);
});

test('la lourde boucle vidéo reste isolée dans la page de tournage', async () => {
  const client = await readFile(clientUrl, 'utf8');
  const capture = await readFile(captureUrl, 'utf8');
  assert.doesNotMatch(client, /getDisplayMedia|MediaRecorder|captureStream\(30\)|context\.drawImage/);
  assert.match(capture, /getDisplayMedia/);
  assert.match(capture, /MediaRecorder/);
  assert.match(capture, /canvas\.captureStream\(30\)/);
  assert.match(capture, /cancelAnimationFrame\(state\.paintFrame\)/);
  assert.match(capture, /getTracks\(\)\.forEach/);
});
