import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const clientUrl = new URL('../../beta/static/assets/velvet-studio-product-demo.js', import.meta.url);
const serverUrl = new URL('../../../functions/api/control/studio-media.js', import.meta.url);
const captureUrl = new URL('../../beta/static/assets/velvet-capture-mode.js', import.meta.url);
const buildUrl = new URL('../../beta/scripts/build.mjs', import.meta.url);

test('le générateur de démonstration compile côté navigateur', async () => {
  const source = await readFile(clientUrl, 'utf8');
  assert.doesNotThrow(() => new Function(source));
  assert.match(source, /Décrivez la démonstration/);
  assert.match(source, /Navigation dans Velvet/);
  assert.match(source, /captureVelvetScreens/);
  assert.match(source, /velvet_capture=/);
});

test('la démonstration produit ne demande aucun visuel FLUX', async () => {
  const source = await readFile(clientUrl, 'utf8');
  assert.doesNotMatch(source, /action:\s*['"]generate_image['"]/);
  assert.match(source, /action:\s*['"]plan_video['"]/);
  assert.match(source, /action:\s*['"]generate_voice['"]/);
  assert.match(source, /domScreenToDataUrl/);
});

test('le scénario Workers AI est limité aux écrans Velvet', async () => {
  const source = await readFile(serverUrl, 'utf8');
  assert.match(source, /ALLOWED_SCREENS/);
  assert.match(source, /mode:\s*'product-demo'/);
  assert.match(source, /aucune photographie inventée/);
  assert.match(source, /pipeline:\s*\['plan', 'velvet-screens', 'voice', 'render'\]/);
});

test('le mode synthétique protège les données membres', async () => {
  const source = await readFile(captureUrl, 'utf8');
  assert.match(source, /capture_mode_synthetic_only/);
  assert.match(source, /Données 100 % synthétiques/);
  assert.match(source, /Aucune donnée membre réelle/);
});

test('le build charge le générateur après le parcours historique', async () => {
  const source = await readFile(buildUrl, 'utf8');
  const legacy = source.indexOf('velvet-studio-v31-compat.js');
  const product = source.indexOf('velvet-studio-product-demo.js');
  assert.ok(legacy >= 0);
  assert.ok(product > legacy);
});

test('le mode illustration historique utilise un schéma FLUX minimal', async () => {
  const source = await readFile(serverUrl, 'utf8');
  assert.match(source, /env\.AI\.run\(IMAGE_MODEL, \{ prompt, steps: 4 \}\)/);
  assert.doesNotMatch(source, /env\.AI\.run\(IMAGE_MODEL, \{ prompt, seed/);
  assert.match(source, /workers_ai_invalid_input/);
});
