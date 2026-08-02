import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(path, 'utf8');
const webFiles = {
  html: 'apps/web/velvet-members-beta-live.html',
  script: 'apps/beta/static/assets/velvet-web-ios-parity.js',
  styles: 'apps/beta/static/assets/velvet-web-ios-parity.css',
  worker: 'apps/beta/static/sw.js'
};

test('le Web mobile présente un vrai fil social avec les médias Supabase', async () => {
  const [html, script, styles, worker] = await Promise.all(Object.values(webFiles).map(read));
  assert.doesNotThrow(() => new Function(script));
  for (const contract of ['Actualité', 'FIL COMMUNAUTAIRE', 'Ce qui se passe maintenant', 'data-open-profile', 'data-open-venue', 'IntersectionObserver']) assert.match(script, new RegExp(contract, 'i'));
  assert.match(script, /mediaAssets/);
  assert.match(script, /media_assets/);
  assert.match(script, /previewUrl/);
  assert.match(script, /moderation_status/);
  assert.match(styles, /web-parity-feed-card/);
  assert.match(styles, /web-parity-feed-photo/);
  assert.match(styles, /aspect-ratio:4\/4\.8/);
  assert.match(html, /velvet-web-ios-parity\.css\?v=20260802-2/);
  assert.match(html, /velvet-web-ios-parity\.js\?v=20260802-2/);
  assert.match(worker, /velvet-beta-shell-v21/);
});

test('la navigation Web supprime la barre latérale et sépare Membres de Lieux', async () => {
  const html = await read(webFiles.html);
  const mobile = html.match(/<nav class="bottom-nav"[\s\S]*?<\/nav>/)?.[0] || '';
  const desktop = html.match(/<nav class="web-primary-nav"[\s\S]*?<\/nav>/)?.[0] || '';
  assert.doesNotMatch(html, /<aside class="sidebar"/);
  assert.equal((mobile.match(/<button/g) || []).length, 5);
  assert.equal((desktop.match(/<button/g) || []).length, 5);
  for (const label of ['Accueil', 'Membres', 'Lieux', 'Messages', 'Profil']) {
    assert.match(mobile, new RegExp(label));
    assert.match(desktop, new RegExp(label));
  }
  assert.match(html, /data-web-route="discover"/);
  assert.match(html, /data-web-route="venues"/);
  assert.doesNotMatch(mobile, />Navigation</);
});

test('les fiches Web reprennent le contenu complet de la fiche iOS', async () => {
  const script = await read(webFiles.script);
  for (const contract of [
    'description', 'story', 'journey', 'searchText', 'search_text', 'practices',
    'valuesList', 'values_list', 'favoritePlaces', 'favorite_places',
    'availabilityText', 'availability_text', 'individualProfiles', 'individual_profiles',
    'genderIdentity', 'gender_identity', 'birthYear', 'birth_year', 'morphology',
    'hairColor', 'hair_color', 'eyeColor', 'eye_color', 'orientation',
    'attractedTo', 'attracted_to', 'desiredPractices', 'desired_practices',
    'partnerPermissions', 'partner_permissions', 'albums', 'media_assets'
  ]) assert.match(script, new RegExp(contract));
  for (const label of ['Le récit', 'Pratiques & expériences', 'Photos & albums', 'Recommandations', 'Sécurité, blocage et signalement']) assert.match(script, new RegExp(label, 'i'));
});

test('les profils, lieux et sorties partagent les informations essentielles', async () => {
  const script = await read(webFiles.script);
  for (const contract of ['On y sera', 'On y était', 'J’y serai', 'J’y étais', 'Soirées organisées', 'Qui a prévu d’y aller', 'Déclarer une sortie']) assert.match(script, new RegExp(contract));
  assert.match(script, /data-publish-venue/);
  assert.match(script, /data-publish-travel/);
  assert.match(script, /action: 'venue_visit'/);
  assert.match(script, /payload\.action = 'travel_plan'/);
  assert.match(script, /\/api\/members\/plans/);
});

test('iOS reste verrouillé sur ses cinq espaces et ses onglets sorties', async () => {
  const [shell, home, outings, member, ownProfile] = await Promise.all([
    read('ios/Velvet/Features/Home/MainShellView.swift'),
    read('ios/Velvet/Features/Home/PeopleFirstHomeView.swift'),
    read('ios/Velvet/Features/Places/SocialOutingsViews.swift'),
    read('ios/Velvet/Features/Discovery/MemberDetailView.swift'),
    read('ios/Velvet/Features/Profile/PremiumOwnProfileOutingsView.swift')
  ]);
  for (const value of ['case home', 'case people', 'case places', 'case messages', 'case profile']) assert.match(shell, new RegExp(value));
  assert.match(shell, /PeopleFirstHomeView/);
  assert.match(shell, /PremiumDiscoveryGridView/);
  assert.match(shell, /PeopleFirstClubDirectoryView/);
  assert.match(home, /FIL COMMUNAUTAIRE/);
  assert.match(outings, /Soirées organisées/);
  assert.match(member, /tab\("Soirées"/);
  assert.match(ownProfile, /tab\("Déclarer une sortie"/);
});

test('tous les boutons Web critiques possèdent une destination explicite', async () => {
  const web = await read(webFiles.script);
  for (const handler of [
    'data-open-profile', 'data-open-venue', 'data-refresh-home', 'data-own-tab',
    'data-outing-type', 'data-declare-venue', 'data-start-conversation',
    'data-lightbox', 'data-publish-venue', 'data-publish-travel'
  ]) assert.match(web, new RegExp(handler));
  assert.match(web, /\/api\/members\/conversations/);
  assert.match(web, /conversationId/);
});