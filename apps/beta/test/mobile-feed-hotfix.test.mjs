import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const scriptPath = new URL('../static/assets/velvet-mobile-feed-hotfix.js', import.meta.url);
const stylePath = new URL('../static/assets/velvet-mobile-feed-hotfix.css', import.meta.url);
const pagePath = new URL('../../web/velvet-members-beta-live.html', import.meta.url);
const membersPath = new URL('../static/assets/members-live.js', import.meta.url);

test('le correctif mobile reste syntaxiquement valide et raccordé à la page membres', async () => {
  const [script, style, page] = await Promise.all([
    readFile(scriptPath, 'utf8'),
    readFile(stylePath, 'utf8'),
    readFile(pagePath, 'utf8')
  ]);

  assert.doesNotThrow(() => new Function(script));
  assert.match(script, /individual_portrait/);
  assert.match(script, /bottom-nav \[data-route="conversations"\]/);
  assert.match(script, /canonicalButton\.click\(\)/);
  assert.match(script, /VelvetWebV11\?\.closeMenu/);
  assert.doesNotMatch(script, /classList\.toggle\('open'/);
  assert.match(script, /openFeedLightbox/);
  assert.match(script, /openConversationDirect/);
  assert.match(style, /grid-template-columns: repeat\(5/);
  assert.match(style, /\.feed-avatar\.is-profile-portrait img/);
  assert.doesNotMatch(style, /velvet-mobile-menu-open/);
  assert.match(style, /\.velvet-photo-lightbox/);
  assert.match(page, /velvet-mobile-feed-hotfix\.css\?v=20260803-3/);
  assert.match(page, /velvet-mobile-feed-hotfix\.js\?v=20260803-3/);
});

test('les interactions essentielles disposent toutes d’un gestionnaire explicite', async () => {
  const [members, hotfix] = await Promise.all([
    readFile(membersPath, 'utf8'),
    readFile(scriptPath, 'utf8')
  ]);

  for (const action of [
    'data-open-profile',
    'data-open-event',
    'data-open-venue',
    'data-open-notification',
    'data-read-all-notifications',
    'data-open-conversation'
  ]) {
    assert.match(members, new RegExp(action));
  }

  assert.match(members, /openProfile\(profileButton\.dataset\.openProfile\)/);
  assert.match(members, /openNotification\(notificationButton\.dataset\.openNotification\)/);
  assert.match(members, /action: 'read_all'/);
  assert.match(hotfix, /event\.target\.closest\('\.feed-photo'\)/);
  assert.match(hotfix, /event\.target\.closest\('\[data-open-conversation\]'\)/);
});
