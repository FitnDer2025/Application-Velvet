import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const clientUrl = new URL('../../beta/static/assets/velvet-studio-live-recorder.js', import.meta.url);
const directorUrl = new URL('../../beta/static/assets/velvet-studio-story-director.js', import.meta.url);
const serverUrl = new URL('../../../functions/api/control/studio-media.js', import.meta.url);
const captureUrl = new URL('../../beta/static/assets/velvet-capture-mode.js', import.meta.url);
const marketingUrl = new URL('../../beta/static/assets/velvet-marketing-mode.js', import.meta.url);
const buildUrl = new URL('../../beta/scripts/build.mjs', import.meta.url);

test('le générateur live compile côté navigateur', async () => {
  const source = await readFile(clientUrl, 'utf8');
  assert.doesNotThrow(() => new Function(source));
  assert.match(source, /Le vrai Velvet/);
  assert.match(source, /getDisplayMedia/);
  assert.match(source, /MediaRecorder/);
  assert.match(source, /velvet_capture=/);
});

test('la démonstration produit enregistre le flux réel sans visuel FLUX', async () => {
  const source = await readFile(clientUrl, 'utf8');
  assert.doesNotMatch(source, /action:\s*['"]generate_image['"]/);
  assert.match(source, /action:\s*['"]plan_video['"]/);
  assert.match(source, /action:\s*['"]generate_voice['"]/);
  assert.match(source, /displayVideo/);
  assert.doesNotMatch(source, /domToImage|fallbackScreen|toDataURL/);
});

test('le scénario sensuel dirige chaque écran réel Velvet', async () => {
  const source = await readFile(serverUrl, 'utf8');
  const director = await readFile(directorUrl, 'utf8');
  assert.doesNotThrow(() => new Function(director));
  assert.match(source, /@cf\/zai-org\/glm-4\.7-flash/);
  assert.match(source, /story-led-product-demo/);
  assert.match(source, /une envie intime → une découverte → une attirance/);
  assert.match(source, /Le scénario est le réalisateur/);
  assert.match(source, /ALLOWED_ACTIONS/);
  assert.match(source, /story-led-velvet-live-recording/);
  assert.match(director, /state\.plan/);
  assert.match(director, /showStoryBeat/);
  assert.match(director, /vsd-caption/);
  assert.match(director, /Arc narratif/);
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

test('le build charge le réalisateur narratif après le Studio live', async () => {
  const source = await readFile(buildUrl, 'utf8');
  const base = source.indexOf('velvet-studio-sprint1.js');
  const live = source.indexOf('velvet-studio-live-recorder.js');
  const director = source.indexOf('velvet-studio-story-director.js');
  assert.ok(base >= 0 && live > base && director > live);
  assert.doesNotMatch(source, /velvet-studio-lite\.js/);
  assert.doesNotMatch(source, /velvet-studio-product-demo\.js/);
  assert.doesNotMatch(source, /velvet-studio-v31-compat\.js/);
});

test('le mode illustration historique utilise un schéma FLUX minimal', async () => {
  const source = await readFile(serverUrl, 'utf8');
  assert.match(source, /env\.AI\.run\(IMAGE_MODEL, \{ prompt, steps: 4 \}\)/);
  assert.doesNotMatch(source, /env\.AI\.run\(IMAGE_MODEL, \{ prompt, seed/);
  assert.match(source, /workers_ai_invalid_input/);
});
