import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(path, 'utf8');
const PREVIEW_TERMS = /\bBETA\b|bêta|version de test|environnement de démonstration|données fictives|données réelles/i;

test('la surface de production couvre les trois socles Zwit', async () => {
  const source = await read('apps/beta/static/assets/velvet-production-surface.js');

  assert.match(source, /Velvet Membres/);
  assert.match(source, /Velvet Pro/);
  assert.match(source, /Velvet Contrôle/);
  assert.match(source, /Synchronisation active/);
  assert.match(source, /Agents qualité/);
  assert.match(source, /MutationObserver/);
  assert.match(source, /velvetMarketingBadge/);
  assert.match(source, /velvetMarketingProBadge/);
});

test('la connexion et le sélecteur de compte chargent la surface de production', async () => {
  const [auth, menu] = await Promise.all([
    read('apps/beta/static/assets/real-auth-gate.js'),
    read('apps/beta/static/assets/account-access-menu.js')
  ]);

  assert.match(auth, /velvet-production-surface\.js/);
  assert.match(menu, /velvet-production-surface\.js/);
  assert.match(auth, /ACCÈS PRIVÉ · 18\+/);
  assert.match(auth, /Velvet Contrôle/);
  assert.doesNotMatch(auth, /invitées à tester|conditions de la BETA|BETA PRIVÉE/i);
});

test('le manifeste mobile et les pages légales ne se présentent plus comme une préversion', async () => {
  const paths = [
    'apps/beta/static/manifest.webmanifest',
    'apps/beta/static/legal/terms/index.html',
    'apps/beta/static/legal/privacy/index.html',
    'apps/beta/static/legal/safety/index.html'
  ];
  const contents = await Promise.all(paths.map(read));
  const combined = contents.join('\n');

  assert.doesNotMatch(combined, PREVIEW_TERMS);
  assert.match(contents[0], /"name": "Zwit"/);
  assert.match(contents[1], /Conditions d’utilisation/);
  assert.match(contents[2], /Politique de confidentialité/);
  assert.match(contents[3], /Sécurité et consentement/);
});

test('l’application iOS expose uniquement la marque Zwit', async () => {
  const info = await read('ios/Velvet/Resources/Info.plist');

  assert.match(info, /<key>CFBundleDisplayName<\/key>\s*<string>Zwit<\/string>/);
  assert.doesNotMatch(info, PREVIEW_TERMS);
});
