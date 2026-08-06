import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const files = {
  setup: 'ios/Velvet/Core/Models/SetupModels.swift',
  media: 'ios/Velvet/Features/Profile/ProfileMediaManagementView.swift',
  store: 'ios/Velvet/Core/Session/VelvetStore.swift',
  home: 'ios/Velvet/Features/Home/IntelligentHomeView.swift',
  places: 'ios/Velvet/Features/Places/IntelligentPlacesEventsView.swift'
};

async function source(name) {
  return readFile(files[name], 'utf8');
}

test('iOS media library decodes photos independently and keeps profile fallback', async () => {
  const setup = await source('setup');
  const media = await source('media');
  assert.match(setup, /struct PhotosResponse[\s\S]*let photos: \[ProfilePhoto\]/);
  assert.doesNotMatch(setup, /let profile: MemberProfile\?/);
  assert.match(media, /profile\?\.profileGalleryPhotos/);
  assert.match(media, /profilePhotos/);
  assert.match(media, /trash\.fill/);
  assert.match(media, /Actualiser les médias/);
  assert.match(media, /async let profileRequest/);
  assert.match(media, /async let photosRequest/);
});

test('iOS startup failures use an inline fallback instead of a modal alert', async () => {
  const store = await source('store');
  const home = await source('home');
  assert.match(store, /@Published private\(set\) var loadIssue/);
  assert.match(store, /loadIssue = ErrorMessage\.text/);
  assert.doesNotMatch(store, /catch \{\s*errorMessage = ErrorMessage\.text\(for: error\)\s*\}\s*\n\s*func refreshMessaging/);
  assert.match(home, /Votre espace reste disponible/);
  assert.match(home, /Continuer sur Zwit/);
  assert.match(home, /intelligenceIssue = ErrorMessage\.text/);
  assert.doesNotMatch(home, /store\.errorMessage = ErrorMessage\.text\(for: error\)/);
});

test('iOS home exposes viewed profiles even without fresh recommendations', async () => {
  const home = await source('home');
  assert.match(home, /Profils consultés/);
  assert.match(home, /store\.viewedProfiles/);
  assert.match(home, /RecentlyViewedProfileCard/);
  assert.match(home, /Votre historique apparaîtra ici/);
  assert.match(home, /À découvrir/);
});

test('iOS Cap d’Agde uses a dedicated premium editorial experience', async () => {
  const places = await source('places');
  assert.match(places, /capDAgdeContent/);
  assert.match(places, /CapDAgdeHero/);
  assert.match(places, /Votre saison au/);
  assert.match(places, /CapDAgdeEventCard/);
  assert.match(places, /CapDAgdeEmptyPanel/);
  assert.match(places, /CapDAgdeDetailHero/);
  assert.match(places, /Publier mon séjour/);
  assert.match(places, /loadIssue = ErrorMessage\.text/);
});
