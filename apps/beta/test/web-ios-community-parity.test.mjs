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
  plansApi: 'functions/api/members/plans.js'
};

test('Web desktop and mobile expose the same five spaces as iOS', async () => {
  const [html, iosShell] = await Promise.all([read(files.html), read(files.iosShell)]);
  const nav = html.match(/<nav class="bottom-nav"[\s\S]*?<\/nav>/)?.[0] || '';
  assert.equal((nav.match(/<button/g) || []).length,5);
  for (const label of ['Accueil','Membres','Lieux','Messages','Profil']) {
    assert.match(nav,new RegExp(label));
    assert.match(iosShell,new RegExp(label));
  }
  for (const route of ['home','members','places','conversations','profile']) assert.match(nav,new RegExp(`data-web-route="${route}"`));
});

test('Web home is a people-first community feed aligned with iOS', async () => {
  const [web, iosHome] = await Promise.all([read(files.web),read(files.iosHome)]);
  assert.doesNotThrow(()=>new Function(web));
  for (const contract of ['Actualité','Ce qui se passe maintenant','a partagé une photo','a enrichi son profil']) assert.match(web,new RegExp(contract,'i'));
  assert.match(iosHome,/FIL COMMUNAUTAIRE/);
  assert.match(web,/\/api\/members\/home-intelligence/);
  assert.match(web,/\/api\/members\/directory/);
  assert.match(web,/\/api\/members\/plans/);
  assert.match(web,/media_assets/);
});

test('Membres et Lieux restent séparés tout en partageant les présences', async () => {
  const [web, iosShell] = await Promise.all([read(files.web),read(files.iosShell)]);
  assert.match(iosShell,/PremiumDiscoveryGridView/);
  assert.match(iosShell,/PeopleFirstClubDirectoryView/);
  assert.match(web,/async function members/);
  assert.match(web,/async function places/);
  assert.match(web,/vp-attendees/);
  assert.match(web,/venueDialog/);
});

test('les sorties utilisent le modèle partagé de visites', async () => {
  const [web, api] = await Promise.all([read(files.web),read(files.plansApi)]);
  assert.match(web,/venueVisits/);
  assert.match(web,/visit_date/);
  assert.match(api,/body\.action === 'venue_visit'/);
  assert.match(api,/profile_venue_visits/);
});

test('les surfaces responsive et le cache PWA utilisent la couche active', async () => {
  const [html, web, styles, worker] = await Promise.all([read(files.html),read(files.web),read(files.styles),read(files.worker)]);
  assert.doesNotThrow(()=>new Function(web));
  assert.match(html,/velvet-web-ios-parity\.css\?v=20260802-2/);
  assert.match(html,/velvet-web-ios-parity\.js\?v=20260802-2/);
  assert.match(styles,/@media\(max-width:900px\)/);
  assert.match(styles,/vp-profile-hero/);
  assert.match(styles,/vp-venue-card/);
  assert.match(styles,/vp-feed-card/);
  assert.match(worker,/velvet-beta-shell-v21/);
  assert.match(worker,/velvet-web-ios-parity\.js\?v=20260802-2/);
});