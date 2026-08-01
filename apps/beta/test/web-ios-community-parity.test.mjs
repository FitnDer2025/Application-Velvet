import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(path, 'utf8');

const files = {
  html: 'apps/web/velvet-members-beta-live.html',
  web: 'apps/beta/static/assets/velvet-community-parity.js',
  bridge: 'apps/beta/static/assets/velvet-community-parity-bridge.js',
  styles: 'apps/beta/static/assets/velvet-community-parity.css',
  shellStyles: 'apps/beta/static/assets/velvet-community-shell.css',
  worker: 'apps/beta/static/sw.js',
  iosShell: 'ios/Velvet/Features/Home/MainShellView.swift',
  iosHome: 'ios/Velvet/Features/Home/IntelligentHomeActivityView.swift',
  iosNavigation: 'ios/Velvet/Features/Home/VelvetNavigationHubView.swift',
  iosOutings: 'ios/Velvet/Features/Places/ProfileOutingsView.swift',
  plansApi: 'functions/api/members/plans.js'
};

test('Web desktop and mobile expose the same four primary spaces as iOS', async () => {
  const [html, iosShell] = await Promise.all([read(files.html), read(files.iosShell)]);
  const bottomNavigation = html.match(/<nav class="bottom-nav"[\s\S]*?<\/nav>/)?.[0] || '';
  assert.equal((bottomNavigation.match(/<button/g) || []).length, 4);
  for (const label of ['Accueil', 'Navigation', 'Messages', 'Profil']) {
    assert.match(bottomNavigation, new RegExp(label));
    assert.match(iosShell, new RegExp(label));
  }
  assert.match(html, /data-unified-route="navigation"/);
  assert.doesNotMatch(bottomNavigation, />Maps</);
  assert.doesNotMatch(bottomNavigation, />Recherche</);
});

test('Web home is a community feed aligned with iOS and not a fixed outings block', async () => {
  const [web, iosHome] = await Promise.all([read(files.web), read(files.iosHome)]);
  assert.doesNotThrow(() => new Function(web));
  for (const contract of [
    'BONJOUR',
    'Votre communauté',
    'À découvrir',
    'Actualité',
    'a publié une nouvelle photo',
    'a enrichi son profil',
    'vient de rejoindre Velvet',
    'a aimé votre photo'
  ]) {
    assert.match(web, new RegExp(contract));
    assert.match(iosHome, new RegExp(contract));
  }
  assert.match(web, /\/api\/members\/home-intelligence/);
  assert.match(web, /\/api\/members\/directory/);
  assert.match(web, /\/api\/members\/plans/);
  assert.match(web, /\/api\/members\/notifications/);
  assert.doesNotMatch(web, /Actualité des sorties/);
});

test('Navigation centralizes profile discovery, clubs, outings and attendance on all interfaces', async () => {
  const [web, iosNavigation, iosOutings] = await Promise.all([
    read(files.web), read(files.iosNavigation), read(files.iosOutings)
  ]);
  for (const contract of [
    'Recherche avancée',
    'Clubs autour de moi',
    'Qui sera présent',
    'Carte Velvet',
    'Cap d’Agde',
    'Agenda complet'
  ]) {
    assert.match(web, new RegExp(contract));
    assert.match(iosNavigation, new RegExp(contract));
  }
  assert.match(web, /J’y serai/);
  assert.match(web, /Nous y serons/);
  assert.match(iosNavigation, /profile\.attendanceFirstPersonLabel/);
  assert.match(iosOutings, /profileType == \.couple \? "Nous y serons" : "J’y serai"/);
  assert.match(web, /Trouver un profil/);
  assert.match(iosNavigation, /Trouver les bons profils/);
  assert.match(web, /venueDirectory/);
  assert.match(web, /venueSearchText/);
  assert.match(web, /addressPublic/);
  assert.match(web, /categoryPrimary/);
  assert.match(web, /data-parity-club-query/);
});

test('A club outing writes the shared profile venue visit model and exposes participants', async () => {
  const [web, api] = await Promise.all([read(files.web), read(files.plansApi)]);
  assert.match(web, /action: 'venue_visit'/);
  assert.match(web, /venueId: venueIdValue/);
  assert.match(web, /visitDate/);
  assert.match(web, /attendanceGroups/);
  assert.match(web, /participantProfiles/);
  assert.match(api, /body\.action === 'venue_visit'/);
  assert.match(api, /profile_venue_visits/);
  assert.match(api, /on_conflict=profile_id,venue_id,visit_date/);
});

test('Responsive premium surfaces cover desktop, mobile and PWA caching', async () => {
  const [html, web, bridge, styles, shellStyles, worker] = await Promise.all([
    read(files.html), read(files.web), read(files.bridge), read(files.styles), read(files.shellStyles), read(files.worker)
  ]);
  assert.doesNotThrow(() => new Function(web));
  assert.doesNotThrow(() => new Function(bridge));
  assert.match(html, /velvet-community-parity\.css\?v=20260801-1/);
  assert.match(html, /velvet-community-shell\.css\?v=20260801-1/);
  assert.match(html, /velvet-community-parity\.js\?v=20260801-1/);
  assert.match(html, /velvet-community-parity-bridge\.js\?v=20260801-1/);
  assert.match(styles, /@media \(max-width: 760px\)/);
  assert.match(styles, /grid-template-columns: repeat\(4/);
  assert.match(styles, /velvet-parity-action-grid/);
  assert.match(shellStyles, /sidebar-tools/);
  assert.match(shellStyles, /mobile-head-actions/);
  assert.match(bridge, /velvet-parity-ownership/);
  assert.match(bridge, /data-velvet-intelligent-home/);
  assert.match(worker, /velvet-beta-shell-v19/);
  assert.match(worker, /velvet-community-parity\.css\?v=20260801-1/);
  assert.match(worker, /velvet-community-shell\.css\?v=20260801-1/);
  assert.match(worker, /velvet-community-parity\.js\?v=20260801-1/);
  assert.match(worker, /velvet-community-parity-bridge\.js\?v=20260801-1/);
});
