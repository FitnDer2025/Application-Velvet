import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(path, 'utf8');

const files = {
  html: 'apps/web/velvet-members-beta-live.html',
  core: 'apps/beta/static/assets/members-live.js',
  shell: 'apps/beta/static/assets/velvet-web-ios-parity.js',
  styles: 'apps/beta/static/assets/velvet-web-ios-parity.css',
  worker: 'apps/beta/static/sw.js',
  iosShell: 'ios/Velvet/Features/Home/MainShellView.swift',
  iosHome: 'ios/Velvet/Features/Home/PeopleFirstHomeView.swift',
  iosPlaces: 'ios/Velvet/Features/Places/SocialOutingsViews.swift',
  plansApi: 'functions/api/members/plans.js'
};

test('Web desktop et mobile exposent les cinq espaces validés sur iOS', async () => {
  const [html, iosShell] = await Promise.all([read(files.html), read(files.iosShell)]);
  const nav = html.match(/<nav class="bottom-nav"[\s\S]*?<\/nav>/)?.[0] || '';
  const routes = [...nav.matchAll(/data-route="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(routes, ['home', 'discover', 'venues', 'conversations', 'me']);
  for (const label of ['Accueil', 'Membres', 'Lieux', 'Messages', 'Profil']) {
    assert.match(nav, new RegExp(label));
    assert.match(iosShell, new RegExp(label));
  }
});

test('l’accueil Web respecte l’ordre people-first de l’iOS', async () => {
  const [core, iosHome] = await Promise.all([read(files.core), read(files.iosHome)]);
  assert.doesNotThrow(() => new Function(core));
  for (const contract of [
    'Actualité',
    'Les profils qui comptent',
    'Ce qui se passe maintenant',
    'a publié une nouvelle photo',
    'a enrichi son profil'
  ]) assert.match(core, new RegExp(contract, 'i'));
  assert.match(core, /homeDiscoveryProfiles/);
  assert.match(core, /homeFeedItems/);
  assert.match(iosHome, /FIL COMMUNAUTAIRE/);
});

test('Membres et Lieux restent distincts et conservent leurs fonctions complètes', async () => {
  const [core, iosPlaces] = await Promise.all([read(files.core), read(files.iosPlaces)]);
  assert.match(core, /function renderDiscover/);
  assert.match(core, /function renderVenues/);
  assert.match(core, /venueUpcomingProfiles/);
  assert.match(core, /function openVenue/);
  assert.match(core, /function openProfile/);
  assert.match(iosPlaces, /PeopleFirstClubDirectoryView/);
  assert.match(iosPlaces, /upcomingAttendance/);
});

test('les sorties utilisent le modèle partagé de visites', async () => {
  const [core, api] = await Promise.all([read(files.core), read(files.plansApi)]);
  assert.match(core, /venueVisits/);
  assert.match(core, /visit_date/);
  assert.match(api, /body\.action === 'venue_visit'/);
  assert.match(api, /profile_venue_visits/);
});

test('les surfaces responsive et le cache PWA utilisent le shell V1.1 actif', async () => {
  const [html, shell, styles, worker] = await Promise.all([
    read(files.html), read(files.shell), read(files.styles), read(files.worker)
  ]);
  assert.doesNotThrow(() => new Function(shell));
  assert.match(html, /members-live\.js\?v=20260803-4/);
  assert.match(html, /velvet-web-ios-parity\.css\?v=20260803-3/);
  assert.match(html, /velvet-web-ios-parity\.js\?v=20260803-3/);
  assert.match(styles, /@media \(max-width: 900px\)/);
  assert.match(styles, /\.home-feed-card/);
  assert.match(styles, /\.venue-directory-grid/);
  assert.match(styles, /\.hero-copy/);
  assert.match(worker, /const CACHE = 'velvet-beta-shell-v26'/);
  assert.match(worker, /velvet-web-ios-parity\.js\?v=20260803-3/);
});
