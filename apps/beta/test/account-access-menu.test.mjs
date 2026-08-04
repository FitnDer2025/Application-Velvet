import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Script } from 'node:vm';

const menu = await readFile('apps/beta/static/assets/account-access-menu.js', 'utf8');
const middleware = await readFile('functions/_middleware.js', 'utf8');
const build = await readFile('apps/beta/scripts/build.mjs', 'utf8');

test('offers account switching in every web interface', () => {
  assert.doesNotThrow(() => new Script(menu));
  assert.match(menu, /Changer de compte/);
  assert.match(menu, /\/api\/auth\/logout/);
  assert.match(menu, /window\.location\.replace\('\/\?mode=login'\)/);
  assert.match(build, /pro-live\.js[\s\S]*account-access-menu\.js/);
  assert.match(build, /control-live\.js[\s\S]*account-access-menu\.js/);
});

test('shows cross-interface shortcuts only for the real admin role', () => {
  assert.match(menu, /roles\.includes\('admin'\)/);
  assert.match(menu, /\/membres\//);
  assert.match(menu, /\/pro\//);
  assert.match(menu, /\/control\//);
  assert.match(middleware, /'\/pro': \[[^\]]*'admin'/);
  assert.match(middleware, /'\/control': \[[^\]]*'admin'/);
  assert.doesNotMatch(menu, /direction.*isAdmin|moderator.*isAdmin/);
});

test('keeps the interface switch in web assets only', () => {
  assert.doesNotMatch(menu, /ios|swift|native/i);
});
