import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(path) {
  return readFile(path, 'utf8');
}

test('iOS requests approximate location when the member space opens', async () => {
  const app = await source('ios/Velvet/VelvetApp.swift');
  const location = await source('ios/Velvet/Core/System/LocationService.swift');
  const plist = await source('ios/Velvet/Resources/Info.plist');

  assert.match(app, /LocationService\(\)/);
  assert.match(app, /configureLocationIfNeeded/);
  assert.match(app, /requestOneShotLocation/);
  assert.match(app, /saveLocation/);
  assert.match(location, /requestWhenInUseAuthorization/);
  assert.match(location, /kCLLocationAccuracyKilometer/);
  assert.match(plist, /NSLocationWhenInUseUsageDescription/);
  assert.match(plist, /position approximative/);
});

test('shared profile members can delete profile and album media', async () => {
  const handler = await source('functions/api/members/photo-management.js');

  assert.match(handler, /requireAdmittedMember/);
  assert.match(handler, /profile_id=eq\.\$\{encodeURIComponent\(profileId\)\}/);
  assert.doesNotMatch(handler, /photo_owner_required/);
  assert.doesNotMatch(handler, /owner_user_id=eq\.\$\{encodeURIComponent\(access\.account\.userId\)\}/);
});

test('own profile reloads private albums with a dedicated profile query', async () => {
  const handler = await source('functions/api/members/profile.js');

  assert.match(handler, /const ALBUM_SELECT/);
  assert.match(handler, /\/rest\/v1\/albums\?select=/);
  assert.match(handler, /profile_id=eq\.\$\{encodeURIComponent\(profile\.id\)\}/);
  assert.match(handler, /return \{ \.\.\.profile, albums: albums \|\| \[\] \}/);
});

test('iOS displays actionable errors for intelligence and media actions', async () => {
  const errors = await source('ios/Velvet/Core/Networking/APIError.swift');

  assert.match(errors, /home_intelligence_failed/);
  assert.match(errors, /photos_read_failed/);
  assert.match(errors, /photo_delete_failed/);
  assert.match(errors, /photo_storage_delete_failed/);
  assert.doesNotMatch(errors, /Velvet ne peut pas terminer cette action pour le moment/);
});
