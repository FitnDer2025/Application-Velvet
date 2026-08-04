import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const clientUrl = new URL('../../beta/static/assets/velvet-studio-lite.js', import.meta.url);
const buildUrl = new URL('../../beta/scripts/build.mjs', import.meta.url);

test('Velvet Studio léger compile et reste annulable', async () => {
  const source = await readFile(clientUrl, 'utf8');
  assert.doesNotThrow(() => new Function(source));
  assert.match(source, /Créer la démonstration/);
  assert.match(source, /state\.controller\?\.abort/);
  assert.match(source, /captureStream\(24\)/);
  assert.match(source, /pct>=lastUi\+5/);
  assert.match(source, /frameCache/);
});

test('Control ne charge plus les anciennes couches Studio', async () => {
  const source = await readFile(buildUrl, 'utf8');
  assert.match(source, /velvet-studio-lite\.js/);
  assert.doesNotMatch(source, /velvet-studio-v2\.js/);
  assert.doesNotMatch(source, /velvet-studio-v3\.js/);
  assert.doesNotMatch(source, /velvet-studio-v31-media\.js/);
  assert.doesNotMatch(source, /velvet-studio-product-demo\.js/);
});

test('le rendu limite les mises à jour de progression', async () => {
  const source = await readFile(clientUrl, 'utf8');
  assert.match(source, /lastUi=-1/);
  assert.match(source, /pct>=lastUi\+5\|\|pct===100/);
  assert.match(source, /await yieldToBrowser\(\)/);
});
