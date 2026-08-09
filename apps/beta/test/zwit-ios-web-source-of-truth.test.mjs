import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(path, 'utf8');

test('Web mobile reprend les six destinations principales du shell iOS', async () => {
  const [html, shell, parity] = await Promise.all([
    read('apps/web/velvet-members-beta-live.html'),
    read('ios/Velvet/Features/Home/MainShellView.swift'),
    read('apps/beta/static/assets/velvet-web-ios-parity.js')
  ]);

  for (const route of ['home', 'discover', 'maps', 'venues', 'conversations', 'me']) {
    assert.match(html, new RegExp(`data-route="${route}"`));
  }
  assert.match(html, /<nav class="bottom-nav"/);
  assert.equal((html.match(/<nav class="bottom-nav"[\s\S]*?<\/nav>/)?.[0].match(/data-route=/g) || []).length, 6);

  for (const tab of ['case home', 'case people', 'case map', 'case places', 'case messages', 'case profile']) {
    assert.ok(shell.includes(tab));
  }

  assert.match(parity, /\['home', 'discover', 'maps', 'venues', 'conversations', 'me'\]/);
  assert.doesNotMatch(parity, /maps:\s*'venues'/);
  assert.match(parity, /dataset\.zwitUiSource = 'ios'/);
});

test('la couche iOS Web est chargée en dernier et remplace les glyphes par des icônes vectorielles', async () => {
  const [html, css, runtime] = await Promise.all([
    read('apps/web/velvet-members-beta-live.html'),
    read('apps/beta/static/assets/zwit-ios-source-of-truth.css'),
    read('apps/beta/static/assets/zwit-ios-source-of-truth.js')
  ]);

  assert.match(html, /zwit-ios-source-of-truth\.css\?v=20260807-1/);
  assert.match(html, /zwit-ios-source-of-truth\.js\?v=20260807-1/);
  assert.ok(html.indexOf('zwit-ios-source-of-truth.css') > html.indexOf('zwit-event-booking.css'));
  assert.ok(html.indexOf('zwit-ios-source-of-truth.js') > html.indexOf('account-access-menu.js'));
  assert.doesNotMatch(html, /<span class="brand-mark">V<\/span>/);
  assert.match(runtime, /zwit-logo-transparent\.png/);
  assert.match(runtime, /class="zwit-ios-symbol"/);
  assert.match(runtime, /document\.documentElement\.dataset\.zwitUiSource = 'ios'/);
  assert.match(css, /grid-template-columns:\s*repeat\(6,minmax\(0,1fr\)\)/);
  assert.match(css, /backdrop-filter:\s*blur\(28px\)/);
  assert.match(css, /safe-area-inset-bottom/);
});

test('Messages Web conserve photo, éphémère et vocal dans le nouveau shell', async () => {
  const [html, source, voice, ephemeral, messages] = await Promise.all([
    read('apps/web/velvet-members-beta-live.html'),
    read('apps/beta/static/assets/zwit-ios-source-of-truth.js'),
    read('apps/beta/static/assets/zwit-voice-notes.js'),
    read('apps/beta/static/assets/zwit-ephemeral-messaging.js'),
    read('functions/api/members/messages.js')
  ]);

  assert.match(html, /zwit-voice-notes\.js/);
  assert.match(html, /zwit-ephemeral-messaging\.js/);
  assert.match(source, /Éphémère/);
  assert.match(source, /Vocal/);
  assert.match(voice, /\/api\/members\/voice-message/);
  assert.match(ephemeral, /\/api\/members\/ephemeral-message/);
  assert.match(messages, /zwit_v15_register_message_attachment/);
  assert.match(messages, /attachment\.attachment_kind === 'ephemeral'/);
  assert.match(messages, /rollbackMessage/);
});

test('Ce soir et Passeport restent chargés dans le shell Web iOS-source', async () => {
  const [html, tonight, passport] = await Promise.all([
    read('apps/web/velvet-members-beta-live.html'),
    read('apps/beta/static/assets/zwit-tonight.js'),
    read('apps/beta/static/assets/zwit-passport.js')
  ]);

  assert.match(html, /zwit-tonight\.js/);
  assert.match(html, /zwit-passport\.js/);
  assert.match(tonight, /\/api\/members\/tonight/);
  assert.match(passport, /\/api\/members\/passport/);
});
