import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const clientUrl = new URL('../../beta/static/assets/velvet-studio-v31-compat.js', import.meta.url);
const serverUrl = new URL('../../../functions/api/control/studio-media.js', import.meta.url);
const directorUrl = new URL('../../beta/static/assets/velvet-studio-story-director.js', import.meta.url);

test('Velvet Studio simple historique compile côté navigateur', async () => {
  const source = await readFile(clientUrl, 'utf8');
  assert.doesNotThrow(() => new Function(source));
  assert.match(source, /Décrivez votre idée/);
  assert.match(source, /Produire ma vidéo/);
  assert.match(source, /Scénario et voix off/);
  assert.match(source, /Montage et export/);
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
  assert.match(source, /pipeline:\s*\['story', 'directed-navigation', 'french-voice', 'live-recording'\]/);
  assert.match(source, /lang:\s*'fr'/);
});

test('le réalisateur narratif contrôle le parcours visible', async () => {
  const source = await readFile(directorUrl, 'utf8');
  assert.doesNotThrow(() => new Function(source));
  assert.match(source, /Une envie\. Une histoire\. Velvet/);
  assert.match(source, /Arc narratif/);
  assert.match(source, /showStoryBeat/);
  assert.match(source, /data-vsd-caption/);
});

test('le mode simple historique masque les accès versionnés de son interface', async () => {
  const source = await readFile(clientUrl, 'utf8');
  assert.match(source, /\[data-open-v2\],\[data-open-v3\]/);
  assert.match(source, /vs-simple-old-action/);
  assert.match(source, /Création vidéo assistée par IA/);
});
