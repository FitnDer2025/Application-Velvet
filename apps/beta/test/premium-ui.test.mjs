import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(path, 'utf8');

test('le système visuel premium reste synchronisé avec la marque Velvet', async () => {
  const [css, ui, manifest] = await Promise.all([
    read('apps/beta/static/assets/velvet-premium-ui.css'),
    read('apps/beta/static/assets/velvet-premium-ui.js'),
    read('apps/beta/static/manifest.webmanifest')
  ]);
  for (const token of ['#0D0D0D','#1B1B1D','#2D2D30','#F4F4F2','#641B36','#C6A96A']) assert.match(css,new RegExp(token,'i'));
  assert.match(ui,/velvet-icon-192\.png/);
  assert.match(manifest,/velvet-icon-512\.png/);
});

test('la navigation mobile Membres conserve cinq espaces communs avec iOS', async () => {
  const html = await read('apps/web/velvet-members-beta-live.html');
  const nav = html.match(/<nav class="bottom-nav"[\s\S]*?<\/nav>/)?.[0] || '';
  const destinations = [...nav.matchAll(/data-web-route="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(destinations,['home','members','places','conversations','profile']);
  for (const label of ['Accueil','Membres','Lieux','Messages','Profil']) assert.match(nav,new RegExp(label));
  assert.match(html,/velvet-web-ios-parity\.css/);
  assert.match(html,/velvet-web-ios-parity\.js/);
  assert.doesNotMatch(html,/velvet-people-first\.js/);
});

test('PRO et Contrôle gardent le langage visuel Velvet', async () => {
  const [pro, control] = await Promise.all([
    read('apps/web/velvet-pro-beta-rc1.html'),
    read('apps/web/velvet-control-intelligence-beta-final.html')
  ]);
  for (const html of [pro,control]) {
    assert.match(html,/velvet-premium-ui\.css/);
    assert.match(html,/velvet-editorial-ui\.css/);
    assert.match(html,/velvet-premium-ui\.js/);
  }
});

test('la direction artistique traite profils, fil et établissements', async () => {
  const [editorial, parity, auth, sw] = await Promise.all([
    read('apps/beta/static/assets/velvet-editorial-ui.css'),
    read('apps/beta/static/assets/velvet-web-ios-parity.css'),
    read('apps/web/velvet-auth-beta-rc1.html'),
    read('apps/beta/static/sw.js')
  ]);
  assert.match(editorial,/\.velvet-member-ui \.profile-layout/);
  assert.match(parity,/\.vp-feed-card/);
  assert.match(parity,/\.vp-profile-hero/);
  assert.match(parity,/\.vp-venue-card/);
  assert.match(parity,/\.sidebar #mainNav button\.active/);
  assert.match(auth,/velvet-editorial-ui\.css/);
  assert.match(sw,/velvet-beta-shell-v21/);
  assert.match(sw,/velvet-web-ios-parity\.js/);
});

test('la messagerie enrichie reste chargée et exploitable sur mobile', async () => {
  const [script, css, directory, messages] = await Promise.all([
    read('apps/beta/static/assets/velvet-messaging-upgrade.js'),
    read('apps/beta/static/assets/velvet-messaging-upgrade.css'),
    read('functions/api/members/directory.js'),
    read('functions/api/members/messages.js')
  ]);
  assert.match(script,/messageUnreadCount/);
  assert.match(css,/\.messages \.message\.mine/);
  assert.match(directory,/participant_photo_url/);
  assert.match(messages,/deliverMessageNotifications/);
});

test('les icônes PWA sont servies comme actifs statiques', async () => {
  for (const [path, expected] of [
    ['apps/beta/static/assets/velvet-icon-180.png',180],
    ['apps/beta/static/assets/velvet-icon-192.png',192],
    ['apps/beta/static/assets/velvet-icon-512.png',512]
  ]) {
    const bytes = await readFile(path);
    assert.equal(bytes.readUInt32BE(16),expected);
    assert.equal(bytes.readUInt32BE(20),expected);
  }
});