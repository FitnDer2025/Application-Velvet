import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(path, 'utf8');

test('le Web mobile présente le fil social people-first complet', async () => {
  const [html, core, styles, worker] = await Promise.all([
    read('apps/web/velvet-members-beta-live.html'),
    read('apps/beta/static/assets/members-live.js'),
    read('apps/beta/static/assets/velvet-web-ios-parity.css'),
    read('apps/beta/static/sw.js')
  ]);
  assert.doesNotThrow(() => new Function(core));
  assert.match(core, /Ce qui se passe maintenant/);
  assert.match(core, /data-open-profile/);
  assert.match(core, /data-open-event/);
  assert.match(core, /approvedProfilePhotos/);
  assert.match(styles, /\.home-feed-card/);
  assert.match(styles, /\.feed-avatar/);
  assert.match(html, /velvet-web-ios-parity\.css\?v=20260803-3/);
  assert.match(worker, /velvet-beta-shell-v24/);
});

test('la navigation sépare clairement Membres et Lieux', async () => {
  const html = await read('apps/web/velvet-members-beta-live.html');
  const nav = html.match(/<nav class="bottom-nav"[\s\S]*?<\/nav>/)?.[0] || '';
  const routes = [...nav.matchAll(/data-route="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(routes, ['home', 'discover', 'venues', 'conversations', 'me']);
  for (const label of ['Accueil', 'Membres', 'Lieux', 'Messages', 'Profil']) assert.match(nav, new RegExp(label));
});

test('les profils et lieux exposent photos, détails, sorties et présences', async () => {
  const core = await read('apps/beta/static/assets/members-live.js');
  assert.match(core, /renderProfile/);
  assert.match(core, /openVenue/);
  assert.match(core, /venueUpcomingProfiles/);
  assert.match(core, /venueVisits/);
  assert.match(core, /profilePreviewCard/);
});

test('iOS reste verrouillé sur les cinq espaces validés', async () => {
  const shell = await read('ios/Velvet/Features/Home/MainShellView.swift');
  for (const value of ['case home', 'case people', 'case places', 'case messages', 'case profile']) {
    assert.match(shell, new RegExp(value));
  }
  assert.match(shell, /PeopleFirstHomeView/);
  assert.match(shell, /PeopleFirstClubDirectoryView/);
});

test('le shell Web gère menu, scrim et cinq destinations sans couche de contenu concurrente', async () => {
  const shell = await read('apps/beta/static/assets/velvet-web-ios-parity.js');
  for (const contract of ['PRIMARY_ROUTES', 'closeMenu', 'toggleMenu', 'ensureScrim', 'synchronizeNavigation']) {
    assert.match(shell, new RegExp(contract));
  }
  assert.doesNotMatch(shell, /content\.innerHTML/);
});
