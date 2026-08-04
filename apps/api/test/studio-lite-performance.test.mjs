import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const clientUrl = new URL('../../beta/static/assets/velvet-studio-live-recorder.js', import.meta.url);
const buildUrl = new URL('../../beta/scripts/build.mjs', import.meta.url);

test('Velvet Studio live compile et reste annulable', async () => {
  const source = await readFile(clientUrl, 'utf8');
  assert.doesNotThrow(() => new Function(source));
  assert.match(source, /Créer et enregistrer la vidéo/);
  assert.match(source, /cancelProduction/);
  assert.match(source, /displayStream\?\.getTracks/);
  assert.match(source, /canvas\.captureStream\(30\)/);
  assert.match(source, /requestAnimationFrame\(paintFrame\)/);
});

test('Control ne charge plus les anciennes couches Studio', async () => {
  const source = await readFile(buildUrl, 'utf8');
  assert.match(source, /velvet-studio-live-recorder\.js/);
  assert.doesNotMatch(source, /velvet-studio-lite\.js/);
  assert.doesNotMatch(source, /velvet-studio-v2\.js/);
  assert.doesNotMatch(source, /velvet-studio-v3\.js/);
  assert.doesNotMatch(source, /velvet-studio-v31-media\.js/);
  assert.doesNotMatch(source, /velvet-studio-product-demo\.js/);
});

test('le rendu live utilise une seule boucle vidéo et libère ses ressources', async () => {
  const source = await readFile(clientUrl, 'utf8');
  assert.match(source, /state\.paintFrame = requestAnimationFrame\(paintFrame\)/);
  assert.match(source, /cancelAnimationFrame\(state\.paintFrame\)/);
  assert.match(source, /canvasStream\.getTracks\(\)\.forEach/);
  assert.match(source, /displayVideo\.srcObject = null/);
  assert.doesNotMatch(source, /domToImage|fallbackScreen|toDataURL/);
});
