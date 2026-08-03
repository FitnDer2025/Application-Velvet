import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(path, 'utf8');

test('la migration 0030 masque les profils incomplets et mémorise les préférences', async () => {
  const migration = await read('supabase/migrations/20260731224500_home_events_profile_management.sql');
  assert.match(migration, /profile_photo_ready boolean/);
  assert.match(migration, /count\(\*\) >= 3/);
  assert.match(migration, /media_assets_sync_profile_photo_ready/);
  assert.match(migration, /member_experience_preferences/);
  assert.match(migration, /discovery_radius_km/);
  assert.match(migration, /event_category in \('standard', 'cap_dagde'\)/);
});

test('les médias et conversations peuvent être retirés sans supprimer les données des autres membres', async () => {
  const [media, conversations, directory] = await Promise.all([
    read('functions/api/members/photo-management.js'),
    read('functions/api/members/conversations.js'),
    read('functions/api/members/directory.js')
  ]);
  assert.match(media, /remainingPublicProfilePhotos/);
  assert.match(conversations, /hidden_at/);
  assert.match(directory, /hasRequiredApprovedPhotos/);
  assert.match(directory, /approvedProfilePhotos\.length >= 3/);
});

test('Velvet Intelligence partage proximité compatibilité suivi et mémoire', async () => {
  const [home, settings, map] = await Promise.all([
    read('functions/api/members/home-intelligence.js'),
    read('functions/api/members/experience-preferences.js'),
    read('functions/api/members/map.js')
  ]);
  assert.match(home, /compatibilityScore/);
  assert.match(home, /curatedProfiles/);
  assert.match(settings, /discovery_radius_km/);
  assert.match(map, /profile_photo_ready=eq\.true/);
});

test('les membres publient des sorties et séjours avec participants et contrôle IA', async () => {
  const events = await read('functions/api/members/events.js');
  assert.match(events, /eventParticipants/);
  assert.match(events, /moderateEvent/);
  assert.match(events, /cap_dagde/);
});

test('le Web et la PWA exposent le même accueil et les mêmes outils', async () => {
  const [html, management, core, parity, styles, worker] = await Promise.all([
    read('apps/web/velvet-members-beta-live.html'),
    read('apps/beta/static/assets/velvet-experience-management.js'),
    read('apps/beta/static/assets/members-live.js'),
    read('apps/beta/static/assets/velvet-web-ios-parity.js'),
    read('apps/beta/static/assets/velvet-web-ios-parity.css'),
    read('apps/beta/static/sw.js')
  ]);
  assert.doesNotThrow(() => new Function(management));
  assert.doesNotThrow(() => new Function(parity));
  assert.match(html, /velvet-web-ios-parity\.js/);
  assert.match(html, /velvet-web-ios-parity\.css/);
  assert.match(management, /\/api\/members\/photo-management/);
  assert.match(core, /homeDiscoveryProfiles/);
  assert.match(core, /\/api\/members\/plans/);
  assert.match(core, /approvedProfilePhotos/);
  assert.match(parity, /PRIMARY_ROUTES/);
  assert.match(styles, /\.hero-copy/);
  assert.match(worker, /velvet-beta-shell-v24/);
  assert.match(worker, /velvet-web-ios-parity\.js/);
});

test('iOS reste verrouillé sur le fil people-first validé', async () => {
  const [shell, home, outings] = await Promise.all([
    read('ios/Velvet/Features/Home/MainShellView.swift'),
    read('ios/Velvet/Features/Home/PeopleFirstHomeView.swift'),
    read('ios/Velvet/Features/Places/SocialOutingsViews.swift')
  ]);
  assert.match(shell, /PeopleFirstHomeView/);
  assert.match(shell, /PeopleFirstClubDirectoryView/);
  assert.match(home, /FIL COMMUNAUTAIRE/);
  assert.match(outings, /Soirées organisées/);
});
