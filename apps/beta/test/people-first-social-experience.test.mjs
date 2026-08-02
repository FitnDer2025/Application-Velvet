import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(path, 'utf8');

test('le Web mobile présente un vrai fil social people-first', async () => {
  const [html, script, styles, worker] = await Promise.all([
    read('apps/web/velvet-members-beta-live.html'),
    read('apps/beta/static/assets/velvet-people-first.js'),
    read('apps/beta/static/assets/velvet-people-first.css'),
    read('apps/beta/static/sw.js')
  ]);

  assert.doesNotThrow(() => new Function(script));
  assert.match(script, /FIL COMMUNAUTAIRE/);
  assert.match(script, /Ce qui se passe maintenant/);
  assert.match(script, /data-open-profile/);
  assert.match(script, /data-open-venue/);
  assert.match(script, /IntersectionObserver/);
  assert.match(script, /participantProfilesFor/);
  assert.match(script, /Également présents/);
  assert.match(styles, /people-first-feed-card/);
  assert.match(styles, /people-first-avatar/);
  assert.match(styles, /aspect-ratio:4\/4\.7/);
  assert.match(html, /velvet-people-first\.css\?v=20260802-1/);
  assert.match(html, /velvet-people-first\.js\?v=20260802-1/);
  assert.match(worker, /velvet-beta-shell-v20/);
});

test('la navigation sépare clairement Membres et Lieux', async () => {
  const html = await read('apps/web/velvet-members-beta-live.html');
  const nav = html.match(/<nav class="bottom-nav"[\s\S]*?<\/nav>/)?.[0] || '';

  assert.equal((nav.match(/<button/g) || []).length, 5);
  for (const label of ['Accueil', 'Membres', 'Lieux', 'Messages', 'Profil']) {
    assert.match(nav, new RegExp(label));
  }
  assert.match(nav, /data-route="discover"/);
  assert.match(nav, /data-people-route="venues"/);
  assert.doesNotMatch(nav, />Navigation</);
});

test('les profils, lieux et sorties partagent les informations essentielles', async () => {
  const script = await read('apps/beta/static/assets/velvet-people-first.js');

  assert.match(script, /On y sera/);
  assert.match(script, /On y était/);
  assert.match(script, /J’y serai/);
  assert.match(script, /J’y étais/);
  assert.match(script, /Soirées organisées/);
  assert.match(script, /Qui a prévu d’y aller/);
  assert.match(script, /Déclarer une sortie/);
  assert.match(script, /data-publish-venue/);
  assert.match(script, /data-publish-travel/);
  assert.match(script, /action: 'venue_visit'/);
  assert.match(script, /payload\.action = 'travel_plan'/);
  assert.match(script, /\/api\/members\/plans/);
});

test('iOS reprend les cinq espaces et les onglets sorties', async () => {
  const [shell, home, outings, member, ownProfile] = await Promise.all([
    read('ios/Velvet/Features/Home/MainShellView.swift'),
    read('ios/Velvet/Features/Home/PeopleFirstHomeView.swift'),
    read('ios/Velvet/Features/Places/SocialOutingsViews.swift'),
    read('ios/Velvet/Features/Discovery/MemberDetailView.swift'),
    read('ios/Velvet/Features/Profile/PremiumOwnProfileOutingsView.swift')
  ]);

  for (const value of ['case home', 'case people', 'case places', 'case messages', 'case profile']) {
    assert.match(shell, new RegExp(value));
  }
  assert.match(shell, /PeopleFirstHomeView/);
  assert.match(shell, /PremiumDiscoveryGridView/);
  assert.match(shell, /PeopleFirstClubDirectoryView/);
  assert.match(home, /FIL COMMUNAUTAIRE/);
  assert.match(home, /SocialMemberIdentityChip/);
  assert.match(home, /visibleCount/);
  assert.match(outings, /On y sera/);
  assert.match(outings, /On y était/);
  assert.match(outings, /J’y serai/);
  assert.match(outings, /J’y étais/);
  assert.match(outings, /SocialVenueDetailView/);
  assert.match(outings, /Soirées organisées/);
  assert.match(outings, /Déclarer une sortie/);
  assert.match(member, /tab\("Soirées"/);
  assert.match(ownProfile, /tab\("Déclarer une sortie"/);
});

test('les boutons critiques possèdent une destination explicite', async () => {
  const [web, shell, outings] = await Promise.all([
    read('apps/beta/static/assets/velvet-people-first.js'),
    read('ios/Velvet/Features/Home/MainShellView.swift'),
    read('ios/Velvet/Features/Places/SocialOutingsViews.swift')
  ]);

  for (const handler of [
    'data-open-profile',
    'data-open-venue',
    'data-refresh-home',
    'data-own-tab',
    'data-outing-type',
    'data-declare-at-venue'
  ]) {
    assert.match(web, new RegExp(handler));
  }
  assert.match(shell, /selectedTab = tab/);
  assert.match(outings, /showsVenue = true/);
  assert.match(outings, /showsEvent = true/);
  assert.match(outings, /showsCap = true/);
  assert.match(outings, /showsTravel = true/);
});