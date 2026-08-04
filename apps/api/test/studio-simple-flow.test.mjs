import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const clientUrl = new URL('../../beta/static/assets/velvet-studio-v31-compat.js', import.meta.url);
const serverUrl = new URL('../../../functions/api/control/studio-media.js', import.meta.url);

test('Velvet Studio simple compile côté navigateur', async () => {
  const source = await readFile(clientUrl, 'utf8');
  assert.doesNotThrow(() => new Function(source));
  assert.match(source, /Décrivez votre idée/);
  assert.match(source, /Produire ma vidéo/);
  assert.match(source, /Scénario et voix off/);
  assert.match(source, /Montage et export/);
});

test('le pipeline Workers AI couvre scénario images et voix', async () => {
  const source = await readFile(serverUrl, 'utf8');
  assert.match(source, /action === 'plan_video'/);
  assert.match(source, /action === 'generate_voice'/);
  assert.match(source, /action !== 'generate_image'/);
  assert.match(source, /@cf\/meta\/llama-3\.1-8b-instruct-fast/);
  assert.match(source, /@cf\/black-forest-labs\/flux-1-schnell/);
  assert.match(source, /@cf\/myshell-ai\/melotts/);
});

test('le mode simple masque les accès versionnés de l’interface principale', async () => {
  const source = await readFile(clientUrl, 'utf8');
  assert.match(source, /\[data-open-v2\],\[data-open-v3\]/);
  assert.match(source, /vs-simple-old-action/);
  assert.match(source, /Création vidéo assistée par IA/);
});
