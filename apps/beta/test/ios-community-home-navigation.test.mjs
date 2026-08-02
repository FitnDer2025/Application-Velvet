import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const files = {
  shell: 'ios/Velvet/Features/Home/MainShellView.swift',
  home: 'ios/Velvet/Features/Home/PeopleFirstHomeView.swift',
  outings: 'ios/Velvet/Features/Places/SocialOutingsViews.swift',
  profileOutings: 'ios/Velvet/Features/Places/ProfileOutingsView.swift',
  venue: 'ios/Velvet/Features/Places/VenueDetailView.swift'
};

async function source(name) {
  return readFile(files[name], 'utf8');
}

test('iOS shell exposes five clear people-first spaces', async () => {
  const shell = await source('shell');
  assert.match(shell, /case home[\s\S]*case people[\s\S]*case places[\s\S]*case messages[\s\S]*case profile/);
  assert.doesNotMatch(shell, /case navigation/);
  assert.match(shell, /case \.people:\s*NavigationStack \{ PremiumDiscoveryGridView/);
  assert.match(shell, /case \.places:\s*NavigationStack \{ PeopleFirstClubDirectoryView/);
  assert.match(shell, /case \.home:\s*NavigationStack \{ PeopleFirstHomeView/);
});

test('iOS home is a scrolling people-first community feed', async () => {
  const home = await source('home');
  assert.match(home, /BONJOUR/);
  assert.match(home, /À DÉCOUVRIR/);
  assert.match(home, /Actualité/);
  assert.match(home, /nouvelle photo/);
  assert.match(home, /a enrichi son profil/);
  assert.match(home, /reaction/);
  assert.match(home, /SocialMemberIdentityChip/);
  assert.match(home, /entityPreviewUrl/);
  assert.match(home, /visibleCount/);
});

test('Lieux centralizes clubs, events, outings and attendance', async () => {
  const outings = await source('outings');
  assert.match(outings, /PeopleFirstClubDirectoryView/);
  assert.match(outings, /Clubs et établissements/);
  assert.match(outings, /Soirées organisées/);
  assert.match(outings, /Qui a prévu d’y aller/);
  assert.match(outings, /ProfileVenuePlanningSheet/);
  assert.match(outings, /venueDirectory \?\? \[\]/);
  assert.match(outings, /localizedCaseInsensitiveContains/);
});

test('club attendance uses the shared visible visit plan', async () => {
  const profileOutings = await source('profileOutings');
  const outings = await source('outings');
  const venue = await source('venue');
  assert.match(profileOutings, /Nous y serons/);
  assert.match(profileOutings, /J’y serai/);
  assert.match(profileOutings, /Elle y sera/);
  assert.match(profileOutings, /Il y sera/);
  assert.match(outings, /On y sera/);
  assert.match(outings, /J’y étais/);
  assert.match(venue, /savePlannedOuting[\s\S]*addVenueVisit/);
  assert.doesNotMatch(venue, /savePlannedOuting[\s\S]*relation: "planning"/);
});