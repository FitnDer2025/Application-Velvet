import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const clientUrl = new URL('../../beta/static/assets/velvet-studio-ai-module.js', import.meta.url);
const serverUrl = new URL('../../../functions/api/control/studio-media.js', import.meta.url);

test('le module IA intégré compile côté navigateur', async () => {
  const source = await readFile(clientUrl, 'utf8');
  assert.doesNotThrow(() => new Function(source));
  assert.match(source, /Assistant IA Velvet/);
  assert.match(source, /Créer avec l’IA/);
  assert.match(source, /Générer le scénario/);
  assert.match(source, /Créer, ouvrir et lire dans Studio/);
});

test('le serveur Workers AI conserve récit illustration et voix française', async () => {
  const source = await readFile(serverUrl, 'utf8');
  assert.match(source, /action === 'plan_video'/);
  assert.match(source, /action === 'generate_voice'/);
  assert.match(source, /action === 'generate_image'/);
  assert.match(source, /@cf\/zai-org\/glm-4\.7-flash/);
  assert.match(source, /@cf\/black-forest-labs\/flux-1-schnell/);
  assert.match(source, /@cf\/myshell-ai\/melotts/);
  assert.match(source, /story-led-product-demo/);
  assert.match(source, /lang:\s*'fr'/);
});

test('le module s’insère sans reconstruire ni masquer la page Studio', async () => {
  const source = await readFile(clientUrl, 'utf8');
  assert.match(source, /findHost/);
  assert.match(source, /\.vs1-project-main/);
  assert.match(source, /hero\.insertAdjacentElement\('afterend'/);
  assert.doesNotMatch(source, /document\.body\.style\.overflow/);
  assert.doesNotMatch(source, /position:fixed;inset:0;z-index:120000/);
  assert.doesNotMatch(source, /MutationObserver/);
});

test('les appels IA sont explicites, bornés et transformés en projet local', async () => {
  const source = await readFile(clientUrl, 'utf8');
  assert.match(source, /AbortController/);
  assert.match(source, /35_000/);
  assert.match(source, /data-vsai-generate/);
  assert.match(source, /data-vsai-voice/);
  assert.match(source, /createProjectFromPlan/);
  assert.match(source, /localStorage\.setItem\(STORAGE_KEY/);
  assert.match(source, /PENDING_PROJECT_KEY/);
  assert.match(source, /AUTOPLAY_KEY/);
  assert.doesNotMatch(source, /getDisplayMedia|MediaRecorder|<iframe/);
});
