import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(path, 'utf8');

test('le chargement critique Membres ne dépend pas des colonnes fraîchement migrées', async () => {
  const directory = await read('functions/api/members/directory.js');

  const profileSelect = directory.match(/const PROFILE_SELECT = \[([\s\S]*?)\]\.join/)?.[1] || '';
  assert.doesNotMatch(profileSelect, /profile_photo_ready/);
  assert.match(directory, /hasRequiredApprovedPhotos/);
  assert.match(directory, /approvedProfilePhotos\.length >= 3/);

  const coreEvents = directory.match(/restJson\(env, '([^']*\/rest\/v1\/events[^']*)'/)?.[1] || '';
  assert.doesNotMatch(coreEvents, /moderation_status|event_category|cap_zone|cap_venue/);

  const coreConversations = directory.match(/restJson\(env, '([^']*\/rest\/v1\/conversations[^']*)'/)?.[1] || '';
  assert.doesNotMatch(coreConversations, /hidden_at|last_delivered_at/);

  assert.match(directory, /hidden_at=not\.is\.null/);
  assert.match(directory, /\.catch\(\(\) => \[\]\)/);
  assert.match(directory, /hiddenConversationIds/);
});
