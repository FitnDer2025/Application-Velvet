import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(path, 'utf8');

test('la PWA conserve une session stable sans renouvellement concurrent', async () => {
  const auth = await read('functions/api/auth/_shared.js');
  assert.match(auth, /ACCESS_COOKIE_NAME/);
  assert.match(auth, /sessionFromAccessCookie/);
  assert.match(auth, /\/auth\/v1\/user/);
  assert.match(auth, /SameSite=Lax/);
  assert.match(auth, /headers\.append\('set-cookie', accessCookie/);
});

test('les couches invisibles ne bloquent plus les interactions Web', async () => {
  const [html, guard] = await Promise.all([
    read('apps/web/velvet-members-beta-live.html'),
    read('apps/beta/static/assets/velvet-interaction-guard.css')
  ]);
  assert.match(html, /velvet-interaction-guard\.css\?v=20260801-1/);
  assert.match(guard, /\.nav-scrim/);
  assert.match(guard, /pointer-events: none !important/);
  assert.match(guard, /body\.velvet-member-ui\.nav-open \.nav-scrim/);
  assert.match(guard, /body\.velvet-member-ui \.sidebar:not\(\.open\)/);
});

test('Xcode expose un scheme partagé pour l’application iPhone Velvet', async () => {
  const scheme = await read('ios/Velvet.xcodeproj/xcshareddata/xcschemes/Velvet.xcscheme');
  assert.match(scheme, /BlueprintIdentifier="100000000000000000000040"/);
  assert.match(scheme, /BuildableName="Velvet\.app"/);
  assert.match(scheme, /BlueprintName="Velvet"/);
  assert.match(scheme, /BuildableProductRunnable/);
});
