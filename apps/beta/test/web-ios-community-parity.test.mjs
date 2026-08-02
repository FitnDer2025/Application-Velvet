import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(path, 'utf8');
const files = {
  html: 'apps/web/velvet-members-beta-live.html',
  web: 'apps/beta/static/assets/velvet-web-ios-parity.js',
  styles: 'apps/beta/static/assets/velvet-web-ios-parity.css',
  worker: 'apps/beta/static/sw.js',
  iosShell: 'ios/Velvet/Features/Home/MainShellView.swift',
  iosHome: 'ios/Velvet/Features/Home/PeopleFirstHomeView.swift',
  iosOutings: 'ios/Velvet/Features/Places/SocialOutingsViews.swift',
  plansApi: 'functions/api/members/plans.js'
};

test('Web desktop et mobile exposent les cinq mêmes espaces que iOS', async () => {
  const [html, iosShell] = await Promise.all([read(files.html), read(files.iosShell)]);
  const bottom = html.match(/<nav class="bottom-nav"[\s\S]*?<\/nav>/)?.[0] || '';
  const desktop = html.match(/<nav class="web-primary-nav"[\s\S]*?<\/nav>/)?.[0] || '';
  assert.equal((bottom.match(/<button/g) || []).length, 5);
  assert.equal((desktop.match(/<button/g) || []).length, 5);
  for (const label of ['Accueil', 'Membres', 'Lieux', 'Messages', 'Profil']) {
    assert.match(bottom, new RegExp(label));
    assert.match(desktop, new RegExp(label));
    assert.match(iosShell, new RegExp(label));
  }
  assert.match(html, /data-web-route="discover"/);
  assert.match(html, /data-web-route="venues"/);
  assert.doesNotMatch(html, /<aside class="sidebar"/);
});

test('l’accueil Web est un fil people-first photographique aligné avec iOS', async () => {
  const [web, iosHome] = await Promise.all([read(files.web), read(files.iosHome)]);
  assert.doesNotThrow(() => new Function(web));
  for (const contract of ['Actualité', 'FIL COMMUNAUTAIRE', 'À DÉCOUVRIR', 'a publié une nouvelle photo', 'a enrichi son profil', 'vient de rejoindre Velvet']) {
    assert.match(web, new RegExp(contract, 'i'));
    assert.match(iosHome, new RegExp(contract, 'i'));
  }
  assert.match(web, /\/api\/members\/home-intelligence/);
  assert.match(web, /\/api\/members\/directory/);
  assert.match(web, /\/api\/members\/plans/);
  assert.match(web, /\/api\/members\/notifications/);
  assert.match(web, /media_assets/);
  assert.match(web, /previewUrl/);
  assert.match(web, /IntersectionObserver/);
});

test('Membres et Lieux restent séparés tout en partageant sorties et participants', async () => {
  const [web, iosShell, iosOutings] = await Promise.all([read(files.web), read(files.iosShell), read(files.iosOutings)]);
  assert.match(iosShell, /PremiumDiscoveryGridView/);
  assert.match(iosShell, /PeopleFirstClubDirectoryView/);
  for (const contract of ['Clubs et établissements', 'Soirées organisées', 'Qui a prévu d’y aller', 'Cap d’Agde', 'Déclarer une sortie']) {
    assert.match(web, new RegExp(contract, 'i'));
    assert.match(iosOutings, new RegExp(contract, 'i'));
  }
  assert.match(web, /J’y serai/);
  assert.match(web, /On y sera/);
  assert.match(web, /venueDirectory/);
  assert.match(web, /addressPublic/);
  assert.match(web, /categoryPrimary/);
  assert.match(web, /data-venue-query/);
});

test('une sortie club écrit le modèle partagé et expose les participants', async () => {
  const [web, api] = await Promise.all([read(files.web), read(files.plansApi)]);
  assert.match(web, /action: 'venue_visit'/);
  assert.match(web, /venueId: venueIdValue/);
  assert.match(web, /visitDate/);
  assert.match(web, /participantsFor/);
  assert.match(web, /web-parity-attendee/);
  assert.match(api, /body\.action === 'venue_visit'/);
  assert.match(api, /profile_venue_visits/);
  assert.match(api, /on_conflict=profile_id,venue_id,visit_date/);
});

test('les surfaces premium couvrent desktop, mobile, fiches plein écran et cache PWA', async () => {
  const [html, web, styles, worker] = await Promise.all([read(files.html), read(files.web), read(files.styles), read(files.worker)]);
  assert.doesNotThrow(() => new Function(web));
  assert.match(html, /velvet-web-ios-parity\.css\?v=20260802-2/);
  assert.match(html, /velvet-web-ios-parity\.js\?v=20260802-2/);
  assert.match(styles, /@media\(max-width:760px\)/);
  assert.match(styles, /grid-template-columns:repeat\(5,1fr\)/);
  assert.match(styles, /web-parity-profile-hero/);
  assert.match(styles, /web-parity-venue-card/);
  assert.match(styles, /web-parity-feed-card/);
  assert.match(styles, /width:100vw;max-width:none;height:100dvh/);
  assert.match(worker, /velvet-beta-shell-v21/);
  assert.match(worker, /velvet-web-ios-parity\.css\?v=20260802-2/);
  assert.match(worker, /velvet-web-ios-parity\.js\?v=20260802-2/);
});