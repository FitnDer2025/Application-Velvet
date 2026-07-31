import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(path, 'utf8');

test('la conversation mobile adopte une ergonomie de messagerie plein écran sans perdre les fonctions Velvet', async () => {
  const [script, css, html, worker] = await Promise.all([
    read('apps/beta/static/assets/velvet-chat-whatsapp.js'),
    read('apps/beta/static/assets/velvet-chat-whatsapp.css'),
    read('apps/web/velvet-members-beta-live.html'),
    read('apps/beta/static/sw.js')
  ]);

  assert.doesNotThrow(() => new Function(script));
  assert.match(script, /velvet-whatsapp-chat/);
  assert.match(script, /velvet-chat-topbar/);
  assert.match(script, /velvet-chat-time/);
  assert.match(script, /participant_profile_id/);
  assert.match(script, /visualViewport/);
  assert.match(script, /textarea\.style\.height/);
  assert.match(script, /Ajouter une photo, une vidéo ou un PDF/);
  assert.match(css, /body\.velvet-whatsapp-chat \.bottom-nav/);
  assert.match(css, /grid-template-rows: minmax\(0, 1fr\) auto/);
  assert.match(css, /\.velvet-chat-day/);
  assert.match(css, /\.message\.group-start/);
  assert.match(css, /\.velvet-chat-time/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(html, /velvet-chat-whatsapp\.css\?v=20260731-1/);
  assert.match(html, /velvet-chat-whatsapp\.js\?v=20260731-1/);
  assert.match(worker, /velvet-beta-shell-v14/);
  assert.match(worker, /velvet-chat-whatsapp\.css\?v=20260731-1/);
  assert.match(worker, /velvet-chat-whatsapp\.js\?v=20260731-1/);
});
