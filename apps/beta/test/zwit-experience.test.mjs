import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const web = await readFile(new URL('apps/beta/static/assets/zwit-experience.js', root), 'utf8');
const messaging = await readFile(new URL('ios/Velvet/Features/Messaging/RealtimeAppleMessagingViews.swift', root), 'utf8');
const profile = await readFile(new URL('ios/Velvet/Features/Discovery/PremiumMemberDetailView.swift', root), 'utf8');
const launch = await readFile(new URL('ios/Velvet/App/RootView.swift', root), 'utf8');
const topbar = await readFile(new URL('ios/Velvet/DesignSystem/AppleShellComponents.swift', root), 'utf8');

test('Zwit opening reveals languages, mist and the official logo', () => {
  assert.match(web, /Chut/);
  assert.match(web, /Silencio/);
  assert.match(web, /Silenzio/);
  assert.match(web, /嘘/);
  assert.match(web, /zwit-opening-mist/);
  assert.match(web, /zwit-logo-official\.jpg/);
  assert.match(launch, /ZwitMistLayer/);
  assert.match(launch, /logoVisible/);
  assert.match(launch, /Image\("VelvetMark"\)/);
});

test('messages expose day separators without swipe dates', () => {
  assert.match(messaging, /RealtimeMessageDaySeparator/);
  assert.doesNotMatch(messaging, /messageDateLabel/);
  assert.doesNotMatch(messaging, /dragOffset/);
  assert.match(web, /zwit-day-separator/);
  assert.doesNotMatch(web, /zwit-dated-message:after/);
});

test('the official Zwit logo is installed at top left on Web and iOS', () => {
  assert.match(web, /zwit-official-brand/);
  assert.match(web, /zwit-logo-official\.jpg/);
  assert.match(topbar, /VelvetMark\(size: 48\)/);
});

test('member profiles expose both album actions', () => {
  assert.match(profile, /Demander l’ouverture d’un album/);
  assert.match(profile, /Ouvrir mes albums privés/);
  assert.match(web, /data-request-album/);
  assert.match(web, /data-open-my-albums/);
});
