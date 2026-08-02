import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(path, 'utf8');

test('le Web mobile présente un vrai fil social people-first', async () => {
  const [html, script, styles, worker] = await Promise.all([
    read('apps/web/velvet-members-beta-live.html'),
    read('apps/beta/static/assets/velvet-web-ios-parity.js'),
    read('apps/beta/static/assets/velvet-web-ios-parity.css'),
    read('apps/beta/static/sw.js')
  ]);
  assert.doesNotThrow(() => new Function(script));
  assert.match(script, /Ce qui se passe maintenant/);
  assert.match(script, /data-vp-profile/);
  assert.match(script, /data-vp-venue/);
  assert.match(script, /media_assets/);
  assert.match(styles, /vp-feed-card/);
  assert.match(styles, /vp-avatar/);
  assert.match(html, /velvet-web-ios-parity\.css\?v=20260802-2/);
  assert.match(html, /velvet-web-ios-parity\.js\?v=20260802-2/);
  assert.match(worker, /velvet-beta-shell-v21/);
});

test('la navigation sépare clairement Membres et Lieux', async () => {
  const html = await read('apps/web/velvet-members-beta-live.html');
  const nav = html.match(/<nav class="bottom-nav"[\s\S]*?<\/nav>/)?.[0] || '';
  assert.equal((nav.match(/<button/g) || []).length, 5);
  for (const route of ['home','members','places','conversations','profile']) assert.match(nav, new RegExp(`data-web-route="${route}"`));
  for (const label of ['Accueil','Membres','Lieux','Messages','Profil']) assert.match(nav, new RegExp(label));
  assert.doesNotMatch(nav, />Navigation</);
});

test('les profils et lieux exposent photo et informations essentielles', async () => {
  const script = await read('apps/beta/static/assets/velvet-web-ios-parity.js');
  assert.match(script, /profileDialog/);
  assert.match(script, /venueDialog/);
  assert.match(script, /vp-profile-hero/);
  assert.match(script, /vp-gallery/);
  assert.match(script, /\/api\/members\/plans/);
});

test('iOS reste verrouillé sur les cinq espaces validés', async () => {
  const shell = await read('ios/Velvet/Features/Home/MainShellView.swift');
  for (const value of ['case home','case people','case places','case messages','case profile']) assert.match(shell,new RegExp(value));
  assert.match(shell, /PeopleFirstHomeView/);
  assert.match(shell, /PeopleFirstClubDirectoryView/);
});

test('les boutons critiques possèdent une destination explicite', async () => {
  const web = await read('apps/beta/static/assets/velvet-web-ios-parity.js');
  for (const handler of ['data-vp-profile','data-vp-venue','data-refresh','data-more','data-close','data-web-route']) assert.match(web,new RegExp(handler));
});