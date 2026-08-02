import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(path, 'utf8');

const files = {
  html: 'apps/web/velvet-members-beta-live.html',
  web: 'apps/beta/static/assets/velvet-people-first.js',
  styles: 'apps/beta/static/assets/velvet-people-first.css',
  worker: 'apps/beta/static/sw.js',
  iosShell: 'ios/Velvet/Features/Home/MainShellView.swift',
  iosHome: 'ios/Velvet/Features/Home/PeopleFirstHomeView.swift',
  iosOutings: 'ios/Velvet/Features/Places/SocialOutingsViews.swift',
  plansApi: 'functions/api/members/plans.js'
};

test('Web desktop and mobile expose the same five people-first spaces as iOS', async () => {
  const [html, iosShell] = await Promise.all([read(files.html), read(files.iosShell)]);
  const bottomNavigation = html.match(/<nav class="bottom-nav"[\s\S]*?<\/nav>/)?.[0] || '';
  assert.equal((bottomNavigation.match(/<button/g) || []).length, 5);
  for (const label of ['Accueil', 'Membres', 'Lieux', 'Messages', 'Profil']) {
    assert.match(bottomNavigation, new RegExp(label));
    assert.match(iosShell, new RegExp(label));
  }
  assert.match(html, /data-route="discover"/);
  assert.match(html, /data-people-route="venues"/);
  assert.doesNotMatch(bottomNavigation, />Navigation</);
  assert.doesNotMatch(bottomNavigation, />Maps</);
});

test('Web home is a people-first community feed aligned with iOS', async () => {
  const [web, iosHome] = await Promise.all([read(files.web), read(files.iosHome)]);
  assert.doesNotThrow(() => new Function(web));
  for (const contract of [
    'Actualité',
    'FIL COMMUNAUTAIRE',
    'À DÉCOUVRIR',
    'a publié une nouvelle photo',
    'a enrichi son profil',
    'vient de rejoindre Velvet',
    'a aimé votre photo'
  ]) {
    assert.match(web, new RegExp(contract, 'i'));
    assert.match(iosHome, new RegExp(contract, 'i'));
  }
  assert.match(web, /\/api\/members\/home-intelligence/);
  assert.match(web, /\/api\/members\/directory/);
  assert.match(web, /\/api\/members\/plans/);
  assert.match(web, /\/api\/members\/notifications/);
  assert.match(web, /IntersectionObserver/);
  assert.doesNotMatch(web, /Actualité des sorties/);
});

test('Membres and Lieux remain separate while sharing outings and attendance', async () => {
  const [web, iosShell, iosOutings] = await Promise.all([
    read(files.web), read(files.iosShell), read(files.iosOutings)
  ]);
  assert.match(iosShell, /PremiumDiscoveryGridView/);
  assert.match(iosShell, /PeopleFirstClubDirectoryView/);
  for (const contract of [
    'Clubs et établissements',
    'Soirées organisées',
    'Qui a prévu d’y aller',
    'Cap d’Agde',
    'Déclarer une sortie'
  ]) {
    assert.match(web, new RegExp(contract, 'i'));
    assert.match(iosOutings, new RegExp(contract, 'i'));
  }
  assert.match(web, /J’y serai/);
  assert.match(web, /On y sera/);
  assert.match(iosOutings, /profile\.profileType == \.couple \? "On y sera" : "J’y serai"/);
  assert.match(web, /venueDirectory/);
  assert.match(web, /venueSearchText/);
  assert.match(web, /addressPublic/);
  assert.match(web, /categoryPrimary/);
  assert.match(web, /data-venue-query/);
});

test('A club outing writes the shared profile venue visit model and exposes participants', async () => {
  const [web, api] = await Promise.all([read(files.web), read(files.plansApi)]);
  assert.match(web, /action: 'venue_visit'/);
  assert.match(web, /venueId: venueIdValue/);
  assert.match(web, /visitDate/);
  assert.match(web, /participantProfilesFor/);
  assert.match(web, /people-first-attendee/);
  assert.match(api, /body\.action === 'venue_visit'/);
  assert.match(api, /profile_venue_visits/);
  assert.match(api, /on_conflict=profile_id,venue_id,visit_date/);
});

test('Responsive premium surfaces cover desktop, mobile and PWA caching', async () => {
  const [html, web, styles, worker] = await Promise.all([
    read(files.html), read(files.web), read(files.styles), read(files.worker)
  ]);
  assert.doesNotThrow(() => new Function(web));
  assert.match(html, /velvet-people-first\.css\?v=20260802-1/);
  assert.match(html, /velvet-people-first\.js\?v=20260802-1/);
  assert.match(styles, /@media\(max-width:760px\)/);
  assert.match(styles, /grid-template-columns:repeat\(5/);
  assert.match(styles, /people-first-profile-hero/);
  assert.match(styles, /people-first-venue-card/);
  assert.match(styles, /people-first-feed-card/);
  assert.match(worker, /velvet-beta-shell-v20/);
  assert.match(worker, /velvet-people-first\.css\?v=20260802-1/);
  assert.match(worker, /velvet-people-first\.js\?v=20260802-1/);
});