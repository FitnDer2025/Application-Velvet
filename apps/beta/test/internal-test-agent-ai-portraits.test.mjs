import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const control = await readFile('functions/api/control/test-agents.js', 'utf8');

test('internal test profiles generate three premium AI portraits with a safe fallback', () => {
  assert.match(control, /gpt-image-1-mini/);
  assert.match(control, /\/v1\/images\/generations/);
  assert.match(control, /\[0, 1, 2\]\.map/);
  assert.match(control, /Aucune nudité/);
  assert.match(control, /portraitPng\(agent, index\)/);
  assert.match(control, /internal_test_only: true/);
});

test('portrait generation remains explicit, internal and idempotent', () => {
  assert.match(control, /assertInternalEnvironment\(env\)/);
  assert.match(control, /body\.action === 'refresh_portraits'/);
  assert.match(control, /alreadyGenerated && !forceAi/);
  assert.match(control, /sync_profile_photo_ready/);
  assert.match(control, /VELVET_TEST_AGENT_IMAGE_MODEL/);
});
