import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const files = {
  shell: 'ios/Velvet/Features/Home/MainShellView.swift',
  home: 'ios/Velvet/Features/Home/IntelligentHomeActivityView.swift',
  navigation: 'ios/Velvet/Features/Home/VelvetNavigationHubView.swift',
  outings: 'ios/Velvet/Features/Places/ProfileOutingsView.swift',
  venue: 'ios/Velvet/Features/Places/VenueDetailView.swift'
};

async function source(name) {
  return readFile(files[name], 'utf8');
}

test('iOS shell exposes four clear member spaces', async () => {
  const shell = await source('shell');
  assert.match(shell, /case home[\s\S]*case navigation[\s\S]*case messages[\s\S]*case profile/);
  assert.doesNotMatch(shell, /case maps/);
  assert.match(shell, /case \.navigation:\s*NavigationStack \{ VelvetNavigationHubView/);
  assert.match(shell, /case \.home:\s*NavigationStack \{ IntelligentHomeActivityView/);
});

test('iOS home is a scrolling community feed', async () => {
  const home = await source('home');
  assert.match(home, /BONJOUR/);
  assert.match(home, /À découvrir/);
  assert.match(home, /Actualité/);
  assert.match(home, /nouvelle photo/);
  assert.match(home, /a enrichi son profil/);
  assert.match(home, /photoReaction/);
  assert.match(home, /CommunityAttendanceDirectoryView/);
  assert.match(home, /entityPreviewUrl/);
});

test('navigation centralizes discovery clubs outings and attendance', async () => {
  const navigation = await source('navigation');
  assert.match(navigation, /Recherche avancée/);
  assert.match(navigation, /Clubs autour de moi/);
  assert.match(navigation, /Qui sera présent/);
  assert.match(navigation, /ProfileVenuePlanningSheet/);
  assert.match(navigation, /CommunityAttendanceDirectoryView/);
  assert.match(navigation, /venueDirectory \?\? \[\]/);
  assert.match(navigation, /localizedCaseInsensitiveContains/);
});

test('club attendance uses the shared visible visit plan', async () => {
  const outings = await source('outings');
  const venue = await source('venue');
  assert.match(outings, /Nous y serons/);
  assert.match(outings, /J’y serai/);
  assert.match(outings, /Elle y sera/);
  assert.match(outings, /Il y sera/);
  assert.match(outings, /ANNUAIRE COMPLET/);
  assert.match(venue, /savePlannedOuting[\s\S]*addVenueVisit/);
  assert.doesNotMatch(venue, /savePlannedOuting[\s\S]*relation: "planning"/);
});
