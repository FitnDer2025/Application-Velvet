import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const clientUrl = new URL('../../beta/static/assets/velvet-studio-ai-module.js', import.meta.url);
const serverUrl = new URL('../../../functions/api/control/studio-media.js', import.meta.url);
const captureUrl = new URL('../../beta/static/assets/velvet-capture-mode.js', import.meta.url);
const marketingUrl = new URL('../../beta/static/assets/velvet-marketing-mode.js', import.meta.url);
const buildUrl = new URL('../../beta/scripts/build.mjs', import.meta.url);

test('le module IA intégré compile et conserve la page Studio', async () => {
  const source = await readFile(clientUrl, 'utf8');
  assert.doesNotThrow(() => new Function(source));
  assert.match(source, /Assistant IA Velvet/);
  assert.match(source, /\.vs1-project-main/);
  assert.match(source, /\.vs1-hero-card/);
  assert.doesNotMatch(source, /innerHTML\s*=\s*homeMarkup|querySelectorAll\('\.vsl-home/);
});

test('l’IA ne démarre aucun enregistrement ni iframe automatiquement', async () => {
  const source = await readFile(clientUrl, 'utf8');
  assert.match(source, /action:\s*'plan_video'/);
  assert.match(source, /action:\s*'generate_voice'/);
  assert.match(source, /data-vsai-generate/);
  assert.match(source, /data-vsai-voice/);
  assert.doesNotMatch(source, /getDisplayMedia|MediaRecorder|captureStream|<iframe|MutationObserver/);
});

test('le scénario sensuel devient un projet du Studio existant', async () => {
  const source = await readFile(serverUrl, 'utf8');
  const client = await readFile(clientUrl, 'utf8');
  assert.match(source, /@cf\/zai-org\/glm-4\.7-flash/);
  assert.match(source, /story-led-product-demo/);
  assert.match(source, /une envie intime → une découverte → une attirance/);
  assert.match(source, /Le scénario est le réalisateur/);
  assert.match(source, /ALLOWED_ACTIONS/);
  assert.match(client, /velvet_studio_sprint1_projects_v2/);
  assert.match(client, /createProjectFromPlan/);
  assert.match(client, /plan\.scenes\.map/);
  assert.match(client, /Le scénario dirige la navigation/);
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

test('le build charge uniquement le Studio historique et son module IA intégré', async () => {
  const source = await readFile(buildUrl, 'utf8');
  const base = source.indexOf('velvet-studio-sprint1.js');
  const inline = source.indexOf('velvet-studio-ai-module.js');
  assert.ok(base >= 0 && inline > base);
  assert.doesNotMatch(source, /velvet-studio-live-recorder\.js/);
  assert.doesNotMatch(source, /velvet-studio-story-director\.js/);
  assert.doesNotMatch(source, /velvet-studio-v31-compat\.js/);
});

test('le mode illustration historique utilise un schéma FLUX minimal', async () => {
  const source = await readFile(serverUrl, 'utf8');
  assert.match(source, /env\.AI\.run\(IMAGE_MODEL, \{ prompt, steps: 4 \}\)/);
  assert.doesNotMatch(source, /env\.AI\.run\(IMAGE_MODEL, \{ prompt, seed/);
  assert.match(source, /workers_ai_invalid_input/);
});
