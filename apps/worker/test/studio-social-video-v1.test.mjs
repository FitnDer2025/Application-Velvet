import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const moduleSource = await readFile('apps/beta/static/assets/velvet-studio-ai-module.js', 'utf8');
const captureSource = await readFile('apps/beta/static/assets/velvet-studio-capture.js', 'utf8');
const proMarketingSource = await readFile('apps/beta/static/assets/velvet-marketing-pro-mode.js', 'utf8');
const planSource = await readFile('functions/api/control/studio-social-plan.js', 'utf8');
const safeSource = await readFile('functions/api/control/studio-media-safe.js', 'utf8');
const buildSource = await readFile('apps/beta/scripts/build.mjs', 'utf8');
const workerSource = await readFile('apps/beta/worker/index.js', 'utf8');

test('le Studio propose uniquement des vidéos Membre et Pro fondées sur les vrais sites', () => {
  assert.doesNotThrow(() => new Function(moduleSource));
  assert.match(moduleSource, /Promouvoir Zwit Membre/);
  assert.match(moduleSource, /Promouvoir Zwit Pro/);
  assert.match(moduleSource, /\/marketing\//);
  assert.match(moduleSource, /\/marketing-pro\//);
  assert.match(moduleSource, /Aucune image générée/);
  assert.doesNotMatch(moduleSource, /generate_image|domToImage|fallbackScreen/);
});

test('la voix finale est une voix française du navigateur et non MeloTTS', () => {
  assert.match(moduleSource, /speechSynthesis/);
  assert.match(moduleSource, /SpeechSynthesisUtterance/);
  assert.match(moduleSource, /\^fr\(\?:-\|_\)/);
  assert.match(moduleSource, /femaleScore/);
  assert.doesNotMatch(moduleSource, /action:\s*['"]generate_voice['"]/);
  assert.match(safeSource, /voiceEngine: 'browser-speech-fr'/);
});

test('le module reste présent dans la bibliothèque et dans l’éditeur', () => {
  assert.match(moduleSource, /\.vs1-project-main/);
  assert.match(moduleSource, /\.vs1-editor-shell/);
  assert.match(moduleSource, /data-vss-shell/);
  assert.match(moduleSource, /data-vss-editor/);
  assert.match(moduleSource, /new MutationObserver\(scheduleInstall\)/);
  assert.match(moduleSource, /Zwit Marketing Membre/);
  assert.match(moduleSource, /Zwit Marketing Pro/);
});

test('le tournage enregistre le flux réel et le recadre au format social', () => {
  assert.doesNotThrow(() => new Function(captureSource));
  assert.match(captureSource, /getDisplayMedia/);
  assert.match(captureSource, /MediaRecorder/);
  assert.match(captureSource, /canvas\.captureStream\(30\)/);
  assert.match(captureSource, /context\.drawImage\(sourceVideo/);
  assert.match(captureSource, /stream\.getAudioTracks\(\)\.length/);
  assert.match(captureSource, /Partager l’audio de l’onglet/);
  assert.match(captureSource, /\/marketing\/\?velvet_capture=/);
  assert.match(captureSource, /\/marketing-pro\/\?velvet_capture=/);
  assert.doesNotMatch(captureSource, /generate_image|flux-1|domToImage/);
});

test('Zwit Marketing Pro utilise le vrai shell Pro avec des données fictives', () => {
  assert.doesNotThrow(() => new Function(proMarketingSource));
  assert.match(proMarketingSource, /\/api\/pro\/workspace/);
  assert.match(proMarketingSource, /BETA MARKETING PRO · DONNÉES FICTIVES/);
  assert.match(proMarketingSource, /data-vp-view/);
  assert.match(proMarketingSource, /dashboard.*venue.*events.*bookings/s);
  assert.match(proMarketingSource, /subscription_status: 'active'/);
});

test('le réalisateur distingue les récits Membre et Pro', () => {
  assert.match(planSource, /MEMBER_SCREENS/);
  assert.match(planSource, /PRO_SCREENS/);
  assert.match(planSource, /pro_dashboard/);
  assert.match(planSource, /pro_venue/);
  assert.match(planSource, /pro_events/);
  assert.match(planSource, /pro_bookings/);
  assert.match(planSource, /@cf\/zai-org\/glm-4\.7-flash/);
  assert.match(safeSource, /generateSocialPlan/);
});

test('le build publie les trois environnements sans ancien raccourci cassé', () => {
  assert.match(buildSource, /marketing\/index\.html/);
  assert.match(buildSource, /marketing-pro\/index\.html/);
  assert.match(buildSource, /studio-capture\/index\.html/);
  assert.match(buildSource, /velvet-studio-capture\.js/);
  assert.match(buildSource, /velvet-marketing-pro-mode\.js/);
  assert.doesNotMatch(buildSource, /velvet-marketing-shortcut\.js/);
});

test('le Worker protège le tournage et autorise la capture d’écran', () => {
  assert.match(workerSource, /'\/studio-capture'/);
  assert.match(workerSource, /'\/marketing-pro'/);
  assert.match(workerSource, /display-capture=\(self\)/);
  assert.match(workerSource, /media-src 'self' blob: data:/);
});
