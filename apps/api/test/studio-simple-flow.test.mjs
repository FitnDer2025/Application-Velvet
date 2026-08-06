import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const clientUrl = new URL('../../beta/static/assets/velvet-studio-ai-module.js', import.meta.url);
const captureUrl = new URL('../../beta/static/assets/velvet-studio-capture.js', import.meta.url);
const safeUrl = new URL('../../../functions/api/control/studio-media-safe.js', import.meta.url);
const planUrl = new URL('../../../functions/api/control/studio-social-plan.js', import.meta.url);

test('le module social compile et présente les deux produits Zwit', async () => {
  const source = await readFile(clientUrl, 'utf8');
  assert.doesNotThrow(() => new Function(source));
  assert.match(source, /Vidéos sociales Velvet/);
  assert.match(source, /Promouvoir Zwit Membre/);
  assert.match(source, /Promouvoir Zwit Pro/);
  assert.match(source, /Écrire le scénario/);
  assert.match(source, /Tourner la vidéo/);
});

test('Workers AI écrit les récits mais ne produit pas la voix finale', async () => {
  const safe = await readFile(safeUrl, 'utf8');
  const plan = await readFile(planUrl, 'utf8');
  assert.match(safe, /generateSocialPlan/);
  assert.match(safe, /voiceEngine: 'browser-speech-fr'/);
  assert.match(safe, /recordingEngine: 'display-media-live-crop'/);
  assert.match(plan, /@cf\/zai-org\/glm-4\.7-flash/);
  assert.match(plan, /MEMBER_SCREENS/);
  assert.match(plan, /PRO_SCREENS/);
});

test('le module reste dans la page Studio et dans son éditeur', async () => {
  const source = await readFile(clientUrl, 'utf8');
  assert.match(source, /\.vs1-project-main/);
  assert.match(source, /\.vs1-editor-shell/);
  assert.match(source, /data-vss-shell/);
  assert.match(source, /data-vss-editor/);
  assert.match(source, /new MutationObserver\(scheduleInstall\)/);
  assert.doesNotMatch(source, /document\.body\.style\.overflow|homeMarkup|createProjectFromPlan/);
});

test('le parcours déclenche un tournage séparé et borné', async () => {
  const client = await readFile(clientUrl, 'utf8');
  const capture = await readFile(captureUrl, 'utf8');
  assert.match(client, /AbortController/);
  assert.match(client, /40_000/);
  assert.match(client, /\/studio-capture\/\?job=/);
  assert.match(client, /speechSynthesis/);
  assert.doesNotMatch(client, /generate_image|generate_voice|domToImage/);
  assert.match(capture, /getDisplayMedia/);
  assert.match(capture, /MediaRecorder/);
  assert.match(capture, /canvas\.captureStream\(30\)/);
});
