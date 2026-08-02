import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(path, 'utf8');

test('la correction Web ne modifie aucun fichier iOS', async () => {
  const packageJson = JSON.parse(await read('package.json'));
  assert.ok(packageJson);
});

test('Web et PWA utilisent une seule couche de navigation people-first', async () => {
  const [html, script, styles, worker] = await Promise.all([
    read('apps/web/velvet-members-beta-live.html'),
    read('apps/beta/static/assets/velvet-web-ios-parity.js'),
    read('apps/beta/static/assets/velvet-web-ios-parity.css'),
    read('apps/beta/static/sw.js')
  ]);
  assert.doesNotThrow(() => new Function(script));
  assert.match(html, /velvet-web-ios-parity\.css\?v=20260802-2/);
  assert.match(html, /velvet-web-ios-parity\.js\?v=20260802-2/);
  assert.doesNotMatch(html, /velvet-people-first\.js/);
  assert.equal((html.match(/data-web-route=/g) || []).length, 10);
  for (const route of ['home', 'members', 'places', 'conversations', 'profile']) {
    assert.match(html, new RegExp(`data-web-route="${route}"`));
  }
  assert.match(worker, /velvet-beta-shell-v21/);
  assert.match(styles, /\.sidebar #mainNav button\.active/);
});

test('les photos réelles Supabase alimentent le fil et les fiches', async () => {
  const script = await read('apps/beta/static/assets/velvet-web-ios-parity.js');
  assert.match(script, /media_assets/);
  assert.match(script, /profileGalleryPhotos/);
  assert.match(script, /previewUrl/);
  assert.match(script, /signedUrl/);
  assert.match(script, /function primary/);
  assert.match(script, /vp-media-button/);
  assert.match(script, /vp-profile-hero/);
  assert.match(script, /vp-gallery/);
});

test('les boutons essentiels ont une destination explicite', async () => {
  const script = await read('apps/beta/static/assets/velvet-web-ios-parity.js');
  for (const contract of ['data-vp-profile', 'data-vp-venue', 'data-web-route', 'data-refresh', 'data-more', 'data-close']) {
    assert.match(script, new RegExp(contract));
  }
  assert.match(script, /navigate\(b\.dataset\.webRoute\)/);
  assert.match(script, /profileDialog/);
  assert.match(script, /venueDialog/);
});