import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const clientUrl = new URL('../../beta/static/assets/velvet-studio-lite.js', import.meta.url);
const serverUrl = new URL('../../../functions/api/control/studio-media.js', import.meta.url);
const captureUrl = new URL('../../beta/static/assets/velvet-capture-mode.js', import.meta.url);
const marketingUrl = new URL('../../beta/static/assets/velvet-marketing-mode.js', import.meta.url);
const buildUrl = new URL('../../beta/scripts/build.mjs', import.meta.url);

test('le générateur léger compile côté navigateur', async () => {
  const source = await readFile(clientUrl, 'utf8');
  assert.doesNotThrow(() => new Function(source));
  assert.match(source, /Décrivez la démonstration/);
  assert.match(source, /Écrans Velvet/);
  assert.match(source, /captureScreens/);
  assert.match(source, /velvet_capture=/);
});

test('la démonstration produit ne demande aucun visuel FLUX', async () => {
  const source = await readFile(clientUrl, 'utf8');
  assert.doesNotMatch(source, /action:\s*['"]generate_image['"]/);
  assert.match(source, /action:\s*['"]plan_video['"]/);
  assert.match(source, /action:\s*['"]generate_voice['"]/);
  assert.match(source, /domToImage/);
});

test('le scénario Workers AI est limité aux écrans Velvet', async () => {
  const source = await readFile(serverUrl, 'utf8');
  assert.match(source, /ALLOWED_SCREENS/);
  assert.match(source, /mode:\s*'product-demo'/);
  assert.match(source, /aucune photographie inventée/);
  assert.match(source, /pipeline:\s*\['plan', 'velvet-screens', 'voice', 'render'\]/);
});

test('la BETA Marketing protège les données membres réelles', async () => {
  const capture = await readFile(captureUrl, 'utf8');
  const marketing = await readFile(marketingUrl, 'utf8');
  assert.match(capture, /\/marketing\//);
  assert.match(capture, /velvet_capture/);
  assert.doesNotMatch(capture, /document\.body\.innerHTML/);
  assert.match(marketing, /Données fictives/);
  assert.match(marketing, /x-velvet-marketing/);
  assert.match(marketing, /studio_access_required/);
  assert.match(marketing, /\/api\/members\/directory/);
  assert.doesNotMatch(marketing, /Données réelles Supabase/);
});

test('le build charge uniquement le générateur léger après le socle Studio', async () => {
  const source = await readFile(buildUrl, 'utf8');
  const base = source.indexOf('velvet-studio-sprint1.js');
  const lite = source.indexOf('velvet-studio-lite.js');
  assert.ok(base >= 0);
  assert.ok(lite > base);
  assert.doesNotMatch(source, /velvet-studio-product-demo\.js/);
  assert.doesNotMatch(source, /velvet-studio-v31-compat\.js/);
});

test('le mode illustration historique utilise un schéma FLUX minimal', async () => {
  const source = await readFile(serverUrl, 'utf8');
  assert.match(source, /env\.AI\.run\(IMAGE_MODEL, \{ prompt, steps: 4 \}\)/);
  assert.doesNotMatch(source, /env\.AI\.run\(IMAGE_MODEL, \{ prompt, seed/);
  assert.match(source, /workers_ai_invalid_input/);
});
