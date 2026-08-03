import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(path, 'utf8');

test('la session PWA utilise un jeton d’accès stable avant de renouveler le refresh token', async () => {
  const [auth, middleware, logout] = await Promise.all([
    read('functions/api/auth/_shared.js'),
    read('functions/_middleware.js'),
    read('functions/api/auth/logout.js')
  ]);

  assert.match(auth, /ACCESS_COOKIE_NAME = 'velvet_beta_access'/);
  assert.match(auth, /sessionFromAccessCookie/);
  assert.match(auth, /SameSite=Lax/);
  assert.match(auth, /appendSessionCookies/);
  assert.match(auth, /appendClearedSessionCookies/);
  assert.match(middleware, /appendSessionCookies\(response\.headers, session\)/);
  assert.doesNotMatch(middleware, /refreshCookie\(session\.refresh_token\)/);
  assert.match(logout, /appendClearedSessionCookies/);
});

test('le service worker ne peut plus mettre une page de connexion en cache sous membres', async () => {
  const worker = await read('apps/beta/static/sw.js');
  const shell = worker.match(/const APP_SHELL = \[([\s\S]*?)\];/)?.[1] || '';

  assert.doesNotMatch(shell, /['"]\/membres\/['"]/);
  assert.match(worker, /event\.request\.mode === 'navigate'/);
  assert.match(worker, /credentials: 'same-origin'/);
  assert.match(worker, /!response\.redirected/);
  assert.match(worker, /velvet-beta-shell-v18/);
});

test('le shell garde le menu accessible et les couches fermées inoffensives', async () => {
  const [html, script, styles, menuShell] = await Promise.all([
    read('apps/web/velvet-members-beta-live.html'),
    read('apps/beta/static/assets/velvet-interaction-recovery.js'),
    read('apps/beta/static/assets/velvet-interaction-recovery.css'),
    read('apps/beta/static/assets/velvet-web-ios-parity.js')
  ]);

  assert.match(html, /velvet-interaction-recovery\.js\?v=20260803-3/);
  assert.match(html, /velvet-interaction-recovery\.css\?v=20260803-3/);
  assert.match(menuShell, /sidebar\.inert = false/);
  assert.match(menuShell, /sidebar\.inert = !open/);
  assert.doesNotMatch(script, /velvet-mobile-menu-open/);
  assert.match(script, /document\.visibilityState === 'visible'/);
  assert.match(styles, /@media \(min-width: 901px\)/);
  assert.match(styles, /pointer-events: none !important/);
});

test('Xcode expose un schéma partagé lançant l’application Velvet', async () => {
  const scheme = await read('ios/Velvet.xcodeproj/xcshareddata/xcschemes/Velvet.xcscheme');

  assert.match(scheme, /BlueprintIdentifier = "100000000000000000000040"/);
  assert.match(scheme, /BuildableName = "Velvet\.app"/);
  assert.match(scheme, /BlueprintName = "Velvet"/);
  assert.match(scheme, /<LaunchAction/);
  assert.doesNotMatch(scheme, /VelvetWidget\.appex/);
});
