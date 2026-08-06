import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const moduleUrl = new URL('../../beta/static/assets/velvet-studio-ai-module.js', import.meta.url);
const captureUrl = new URL('../../beta/static/assets/velvet-studio-capture.js', import.meta.url);
const marketingUrl = new URL('../../beta/static/assets/velvet-marketing-mode.js', import.meta.url);
const proMarketingUrl = new URL('../../beta/static/assets/velvet-marketing-pro-mode.js', import.meta.url);
const planUrl = new URL('../../../functions/api/control/studio-social-plan.js', import.meta.url);
const buildUrl = new URL('../../beta/scripts/build.mjs', import.meta.url);

test('le module social compile et conserve la page Studio', async () => {
  const source = await readFile(moduleUrl, 'utf8');
  assert.doesNotThrow(() => new Function(source));
  assert.match(source, /Vidéos sociales Zwit/);
  assert.match(source, /\.vs1-project-main/);
  assert.match(source, /\.vs1-editor-shell/);
  assert.doesNotMatch(source, /innerHTML\s*=\s*homeMarkup|querySelectorAll\('\.vsl-home/);
});

test('Control ne démarre aucun enregistrement sans action explicite', async () => {
  const source = await readFile(moduleUrl, 'utf8');
  assert.match(source, /data-vss-generate/);
  assert.match(source, /data-vss-shoot/);
  assert.match(source, /window\.open/);
  assert.doesNotMatch(source, /getDisplayMedia|MediaRecorder|captureStream\(30\)|domToImage/);
});

test('les récits pilotent les écrans réels de chaque produit', async () => {
  const plan = await readFile(planUrl, 'utf8');
  assert.match(plan, /@cf\/zai-org\/glm-4\.7-flash/);
  assert.match(plan, /MEMBER_SCREENS/);
  assert.match(plan, /PRO_SCREENS/);
  assert.match(plan, /home.*discover.*profile.*messages.*events.*map/s);
  assert.match(plan, /pro_dashboard.*pro_venue.*pro_events.*pro_bookings/s);
  assert.match(plan, /sensuelle, émotionnelle et élégante/);
  assert.match(plan, /visibilité, maîtrise et sérénité/);
});

test('les deux environnements Marketing protègent les données réelles', async () => {
  const member = await readFile(marketingUrl, 'utf8');
  const pro = await readFile(proMarketingUrl, 'utf8');
  assert.match(member, /Données fictives/);
  assert.match(member, /x-velvet-marketing/);
  assert.match(member, /studio_access_required/);
  assert.match(pro, /DONNÉES FICTIVES/);
  assert.match(pro, /x-velvet-marketing-pro/);
  assert.match(pro, /studio_access_required/);
  assert.doesNotMatch(member, /Données réelles Supabase/);
});

test('le tournage produit une vidéo continue issue de l’onglet', async () => {
  const source = await readFile(captureUrl, 'utf8');
  assert.doesNotThrow(() => new Function(source));
  assert.match(source, /getDisplayMedia/);
  assert.match(source, /MediaRecorder/);
  assert.match(source, /context\.drawImage\(sourceVideo/);
  assert.match(source, /navigateScene/);
  assert.match(source, /speechSynthesis/);
  assert.doesNotMatch(source, /generate_image|flux-1-schnell|domToImage/);
});

test('le build publie uniquement le parcours social actif après le socle Studio', async () => {
  const source = await readFile(buildUrl, 'utf8');
  const base = source.indexOf('velvet-studio-sprint1.js');
  const social = source.indexOf('velvet-studio-ai-module.js');
  assert.ok(base >= 0 && social > base);
  assert.match(source, /marketing-pro\/index\.html/);
  assert.match(source, /studio-capture\/index\.html/);
  assert.doesNotMatch(source, /velvet-studio-live-recorder\.js|velvet-studio-story-director\.js|velvet-studio-v31-compat\.js/);
});
