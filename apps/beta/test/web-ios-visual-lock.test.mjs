import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(path, 'utf8');

test('la correction Web ne remplace pas le code iOS par une WebView', async () => {
  const root = await read('ios/Velvet/App/RootView.swift');
  assert.doesNotMatch(root, /WKWebView|SFSafariViewController/);
});

test('Web et PWA exécutent un seul cœur fonctionnel sous un shell V1.1', async () => {
  const [html, shell, worker] = await Promise.all([
    read('apps/web/velvet-members-beta-live.html'),
    read('apps/beta/static/assets/velvet-web-ios-parity.js'),
    read('apps/beta/static/sw.js')
  ]);
  assert.doesNotThrow(() => new Function(shell));
  assert.match(html, /members-live\.js\?v=20260803-1/);
  assert.ok(html.indexOf('members-live.js') < html.indexOf('velvet-web-ios-parity.js'));
  assert.doesNotMatch(html, /velvet-people-first\.js/);
  assert.equal((html.match(/<nav class="bottom-nav"[\s\S]*?<\/nav>/)?.[0].match(/data-route=/g) || []).length, 5);
  assert.match(shell, /PRIMARY_ROUTES = \['home', 'discover', 'venues', 'conversations', 'me'\]/);
  assert.match(worker, /velvet-beta-shell-v22/);
});

test('les photos Supabase alimentent le fil, les résultats et les fiches complètes', async () => {
  const core = await read('apps/beta/static/assets/members-live.js');
  for (const contract of [
    'approvedProfilePhotos',
    'homeDiscoveryCard',
    'profilePreviewCard',
    'profileCarousel',
    'albumsView',
    'renderProfile'
  ]) assert.match(core, new RegExp(contract));
});

test('les boutons critiques conservent une destination fonctionnelle', async () => {
  const core = await read('apps/beta/static/assets/members-live.js');
  for (const contract of [
    'data-open-profile',
    'data-open-venue',
    'data-open-conversation',
    'data-route',
    'data-edit-profile',
    'data-message-profile'
  ]) assert.match(core, new RegExp(contract));
  assert.match(core, /function route/);
  assert.match(core, /function bindDynamicForms/);
});
