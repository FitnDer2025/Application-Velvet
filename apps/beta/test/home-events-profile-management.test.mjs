import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(path, 'utf8');

test('la migration 0030 masque les profils incomplets et mémorise les préférences', async () => {
  const migration = await read('supabase/migrations/20260731224500_home_events_profile_management.sql');
  assert.match(migration, /profile_photo_ready boolean/);
  assert.match(migration, /count\(\*\) >= 3/);
  assert.match(migration, /media_assets_sync_profile_photo_ready/);
  assert.match(migration, /after insert or update or delete/);
  assert.match(migration, /hidden_at timestamptz/);
  assert.match(migration, /member_experience_preferences/);
  assert.match(migration, /discovery_radius_km/);
  assert.match(migration, /event_category in \('standard', 'cap_dagde'\)/);
  assert.match(migration, /ai_assessment jsonb/);
});

test('les médias et conversations peuvent être retirés sans supprimer les données des autres membres', async () => {
  const [media, conversations, directory] = await Promise.all([
    read('functions/api/members/photo-management.js'),
    read('functions/api/members/conversations.js'),
    read('functions/api/members/directory.js')
  ]);
  assert.match(media, /remainingPublicProfilePhotos/);
  assert.match(media, /profileVisible/);
  assert.match(media, /sync_profile_photo_ready/);
  assert.match(conversations, /onRequestDelete/);
  assert.match(conversations, /hidden_at/);
  assert.doesNotMatch(conversations, /\/rest\/v1\/messages\?.*DELETE/);
  assert.match(directory, /profile_photo_ready === true/);
  assert.match(directory, /ownMembership\.hidden_at/);
});

test('Velvet Intelligence partage proximité compatibilité suivi et mémoire glaçon flammes', async () => {
  const [home, settings, map] = await Promise.all([
    read('functions/api/members/home-intelligence.js'),
    read('functions/api/members/experience-preferences.js'),
    read('functions/api/members/map.js')
  ]);
  assert.match(home, /compatibilityScore/);
  assert.match(home, /curatedProfiles/);
  assert.match(home, /nearbyClubs/);
  assert.match(home, /nearbyEvents/);
  assert.match(home, /followedActivities/);
  assert.match(home, /reaction < 0/);
  assert.match(home, /distanceKm/);
  assert.match(settings, /discovery_radius_km/);
  assert.match(settings, /profile_sort/);
  assert.match(map, /member_experience_preferences/);
  assert.match(map, /profile_photo_ready=eq\.true/);
});

test('les membres publient des sorties et séjours Cap d’Agde avec participants et contrôle IA', async () => {
  const events = await read('functions/api/members/events.js');
  assert.match(events, /eventCategory/);
  assert.match(events, /cap_dagde/);
  assert.match(events, /eventParticipants/);
  assert.match(events, /visible_to_participants=eq\.true/);
  assert.match(events, /moderateEvent/);
  assert.match(events, /human_review_required/);
  assert.match(events, /adultes consentants/);
  assert.match(events, /onRequestDelete/);
});

test('le Web et la PWA exposent le même accueil et les mêmes outils', async () => {
  const [html, script, styles, worker] = await Promise.all([
    read('apps/web/velvet-members-beta-live.html'),
    read('apps/beta/static/assets/velvet-experience-management.js'),
    read('apps/beta/static/assets/velvet-experience-management.css'),
    read('apps/beta/static/sw.js')
  ]);
  assert.doesNotThrow(() => new Function(script));
  assert.match(html, /velvet-experience-management\.js/);
  assert.match(html, /velvet-experience-management\.css/);
  assert.match(script, /\/api\/members\/home-intelligence/);
  assert.match(script, /\/api\/members\/photo-management/);
  assert.match(script, /\/api\/members\/conversations/);
  assert.match(script, /\/api\/members\/events/);
  assert.match(script, /data-velvet-all-profile-grid/);
  assert.match(script, /Cap d’Agde/);
  assert.match(styles, /\.velvet-profile-grid/);
  assert.match(styles, /\.velvet-media-manager-grid/);
  assert.match(worker, /velvet-beta-shell-v17/);
  assert.match(worker, /velvet-experience-management\.js/);
});

test('iOS utilise l’accueil intelligent, les événements, la suppression et le rayon partagé', async () => {
  const [shell, home, places, media, conversations, settings, service, models] = await Promise.all([
    read('ios/Velvet/Features/Home/MainShellView.swift'),
    read('ios/Velvet/Features/Home/IntelligentHomeView.swift'),
    read('ios/Velvet/Features/Places/IntelligentPlacesEventsView.swift'),
    read('ios/Velvet/Features/Profile/ProfileMediaManagementView.swift'),
    read('ios/Velvet/Features/Messaging/ManagedConversationsView.swift'),
    read('ios/Velvet/Features/Profile/ExperienceSettingsView.swift'),
    read('ios/Velvet/Core/Session/SessionService+Experience.swift'),
    read('ios/Velvet/Core/Models/ExperienceModels.swift')
  ]);
  assert.match(shell, /IntelligentHomeView/);
  assert.match(shell, /ManagedConversationsView/);
  assert.match(shell, /ProfileMediaManagementView/);
  assert.match(home, /curatedProfiles/);
  assert.match(home, /Classés par proximité/);
  assert.match(home, /affinitySymbol/);
  assert.match(places, /EventCreationView/);
  assert.match(places, /Participants visibles/);
  assert.match(places, /Cap d’Agde/);
  assert.match(media, /trois photos de profil validées/);
  assert.match(conversations, /removeConversation/);
  assert.match(settings, /Rayon de découverte/);
  assert.match(service, /homeIntelligence/);
  assert.match(service, /deleteProfileMedia/);
  assert.match(service, /createEvent/);
  assert.match(models, /HomeIntelligenceResponse/);
  assert.match(models, /EventDetailsResponse/);
});
