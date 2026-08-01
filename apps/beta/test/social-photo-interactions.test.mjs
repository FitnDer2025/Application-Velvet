import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(path, 'utf8');

test('le fil ouvre les profils et les photos acceptent les réactions', async () => {
  const [script, css, endpoint, html, worker] = await Promise.all([
    read('apps/beta/static/assets/velvet-social-interactions-hotfix.js'),
    read('apps/beta/static/assets/velvet-social-interactions-hotfix.css'),
    read('functions/api/members/photo-reactions.js'),
    read('apps/web/velvet-members-beta-live.html'),
    read('apps/beta/static/sw.js')
  ]);

  assert.doesNotThrow(() => new Function(script));
  assert.match(script, /dataset\.socialProfileId/);
  assert.match(script, /dispatchProfileOpen/);
  assert.match(script, /velvet-lightbox-reactions/);
  assert.match(script, /\/api\/members\/photo-reactions/);
  assert.match(script, /setInterval\(pollNotifications, 5000\)/);
  assert.match(script, /event_type === 'reactions'/);

  assert.match(css, /\.velvet-lightbox-reactions/);
  assert.match(css, /\.messages::before/);
  assert.match(css, /flex:\s*1 1 auto/);
  assert.match(css, /body\.velvet-keyboard-open/);

  assert.match(endpoint, /notifyPhotoOwner/);
  assert.match(endpoint, /event_type:\s*'reactions'/);
  assert.match(endpoint, /entity_type:\s*'photo'/);
  assert.match(endpoint, /member_notifications/);
  assert.match(endpoint, /waitUntil/);
  assert.match(endpoint, /metadata:/);

  assert.match(html, /velvet-social-interactions-hotfix\.css\?v=20260731-1/);
  assert.match(html, /velvet-social-interactions-hotfix\.js\?v=20260731-1/);
  assert.match(worker, /velvet-beta-shell-v17/);
  assert.match(worker, /velvet-social-interactions-hotfix\.css\?v=20260731-1/);
  assert.match(worker, /velvet-social-interactions-hotfix\.js\?v=20260731-1/);
});
