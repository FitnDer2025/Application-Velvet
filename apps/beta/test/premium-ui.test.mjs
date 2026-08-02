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
  for (const token of ['#0D0D0D', '#1B1B1D', '#2D2D30', '#F4F4F2', '#641B36', '#C6A96A']) {
    assert.match(css, new RegExp(token, 'i'), `Le token ${token} doit rester présent.`);
  }
  assert.match(ui, /velvet-icon-192\.png/);
  assert.match(ui, /stroke-width="1\.65"/);
  assert.match(manifest, /velvet-icon-512\.png/);
  assert.doesNotMatch(manifest, /velvet-icon\.svg/);
});

test('la navigation Web adopte les cinq espaces iOS sans barre latérale', async () => {
  const [html, parity] = await Promise.all([
    read('apps/web/velvet-members-beta-live.html'),
    read('apps/beta/static/assets/velvet-web-ios-parity.css')
  ]);
  const nav = html.match(/<nav class="bottom-nav"[\s\S]*?<\/nav>/)?.[0] || '';
  const destinations = [...nav.matchAll(/data-(?:route|web-route)="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(destinations, ['home', 'discover', 'venues', 'conversations', 'profile']);
  for (const label of ['Accueil', 'Membres', 'Lieux', 'Messages', 'Profil']) assert.match(nav, new RegExp(label));
  assert.doesNotMatch(html, /<aside class="sidebar"/);
  assert.match(html, /web-desktop-head/);
  assert.match(html, /web-primary-nav/);
  assert.match(parity, /\.sidebar\{display:none!important\}/);
  assert.match(parity, /grid-template-columns:repeat\(5,1fr\)/);
  assert.match(html, /velvet-web-ios-parity\.css/);
  assert.match(html, /velvet-web-ios-parity\.js/);
  assert.match(html, /velvet-messaging-upgrade\.css/);
  assert.match(html, /velvet-messaging-upgrade\.js/);
  assert.match(html, /velvet-chat-whatsapp\.css/);
  assert.match(html, /velvet-chat-whatsapp\.js/);
  assert.match(html, /velvet-social-realtime\.css/);
  assert.match(html, /velvet-social-realtime\.js/);
  assert.match(html, /velvet-realtime-reconcile\.js/);
  assert.match(html, /velvet-experience-management\.css/);
  assert.match(html, /velvet-experience-management\.js/);
});

test('PRO et Contrôle chargent le même langage visuel et mobile', async () => {
  const [pro, control, css] = await Promise.all([
    read('apps/web/velvet-pro-beta-rc1.html'),
    read('apps/web/velvet-control-intelligence-beta-final.html'),
    read('apps/beta/static/assets/velvet-premium-ui.css')
  ]);
  for (const html of [pro, control]) {
    assert.match(html, /velvet-premium-ui\.css/);
    assert.match(html, /velvet-editorial-ui\.css/);
    assert.match(html, /velvet-premium-ui\.js/);
    assert.match(html, /velvet-icon-192\.png/);
  }
  assert.match(css, /\.velvet-pro-ui \.mobile-nav/);
  assert.match(css, /\.velvet-control-ui \.control-mobile-nav/);
});

test('la direction artistique éditoriale traite les profils et toutes les surfaces produit', async () => {
  const [css, parity, ui, auth, sw] = await Promise.all([
    read('apps/beta/static/assets/velvet-editorial-ui.css'),
    read('apps/beta/static/assets/velvet-web-ios-parity.css'),
    read('apps/beta/static/assets/velvet-premium-ui.js'),
    read('apps/web/velvet-auth-beta-rc1.html'),
    read('apps/beta/static/sw.js')
  ]);
  for (const selector of [
    '.velvet-member-ui .hero', '.velvet-member-ui .profile-layout',
    '.velvet-member-ui .discover-layout', '.velvet-member-ui .velvet-map',
    '.velvet-member-ui .settings-layout', '.velvet-pro-ui .content',
    '.velvet-control-ui .page', '.velvet-auth-ui .auth-box'
  ]) assert.match(css, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(parity, /web-parity-feed-card/);
  assert.match(parity, /web-parity-profile-hero/);
  assert.match(parity, /web-parity-venue-card/);
  assert.match(ui, /dataset\.velvetView/);
  assert.match(auth, /velvet-editorial-ui\.css/);
  assert.match(sw, /velvet-beta-shell-v21/);
  assert.match(sw, /velvet-editorial-ui\.css/);
  assert.match(sw, /velvet-messaging-upgrade\.css/);
  assert.match(sw, /velvet-messaging-upgrade\.js/);
  assert.match(sw, /velvet-chat-whatsapp\.css/);
  assert.match(sw, /velvet-chat-whatsapp\.js/);
  assert.match(sw, /velvet-social-realtime\.js/);
  assert.match(sw, /velvet-realtime-reconcile\.js/);
  assert.match(sw, /velvet-experience-management\.js/);
  assert.match(sw, /velvet-web-ios-parity\.js/);
});

test('la messagerie enrichie reste chargée et exploitable sur mobile', async () => {
  const [script, css, directory, messages] = await Promise.all([
    read('apps/beta/static/assets/velvet-messaging-upgrade.js'),
    read('apps/beta/static/assets/velvet-messaging-upgrade.css'),
    read('functions/api/members/directory.js'),
    read('functions/api/members/messages.js')
  ]);
  assert.match(script, /messageUnreadCount/);
  assert.match(script, /participant_display_name/);
  assert.match(script, /velvet-mobile-menu-open/);
  assert.match(script, /document\.createElement\('textarea'\)/);
  assert.match(css, /\.messages \.message\.mine/);
  assert.match(css, /\.velvet-message-badge/);
  assert.match(directory, /unread_count/);
  assert.match(directory, /participant_photo_url/);
  assert.match(messages, /updateConversationReceipt/);
  assert.match(messages, /deliverMessageNotifications/);
});

test('les icônes PWA sont servies comme actifs statiques', async () => {
  const [worker, gate, ios] = await Promise.all([
    read('apps/beta/worker/index.js'),
    read('apps/beta/static/assets/real-auth-gate.js'),
    read('apps/beta/static/assets/pwa-ios.js')
  ]);
  assert.doesNotMatch(worker, /velvetIconResponse/);
  assert.match(gate, /vg-mark"><img src="\/assets\/velvet-icon-192\.png"/);
  assert.match(ios, /velvet-ios-icon"><img src="\/assets\/velvet-icon-192\.png"/);
  for (const [path, expected] of [
    ['apps/beta/static/assets/velvet-icon-180.png', 180],
    ['apps/beta/static/assets/velvet-icon-192.png', 192],
    ['apps/beta/static/assets/velvet-icon-512.png', 512]
  ]) {
    const bytes = await readFile(path);
    assert.equal(bytes.readUInt32BE(16), expected);
    assert.equal(bytes.readUInt32BE(20), expected);
  }
});