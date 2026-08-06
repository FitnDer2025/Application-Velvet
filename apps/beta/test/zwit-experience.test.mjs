import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const web = await readFile(new URL('apps/beta/static/assets/zwit-experience.js', root), 'utf8');
const messaging = await readFile(new URL('ios/Velvet/Features/Messaging/RealtimeAppleMessagingViews.swift', root), 'utf8');
const profile = await readFile(new URL('ios/Velvet/Features/Discovery/PremiumMemberDetailView.swift', root), 'utf8');
const launch = await readFile(new URL('ios/Velvet/App/RootView.swift', root), 'utf8');

test('Zwit opening is sequential, multilingual and reveals the approved logo', () => {
  assert.match(web, /Chut/);
  assert.match(web, /Silencio/);
  assert.match(web, /Silenzio/);
  assert.match(web, /嘘/);
  assert.match(web, /zwit-logo-1024\.png/);
  assert.match(web, /zwitFog/);
  assert.match(launch, /Un secret se partage/);
});

test('messages expose day separators and no Web per-message swipe date', () => {
  assert.match(messaging, /RealtimeMessageDaySeparator/);
  assert.match(web, /zwit-day-separator/);
  assert.doesNotMatch(web, /zwit-dated-message/);
  assert.doesNotMatch(web, /zwitFullDate/);
});

test('member profiles expose both album actions', () => {
  assert.match(profile, /Demander l’ouverture d’un album/);
  assert.match(profile, /Ouvrir mes albums privés/);
  assert.match(web, /data-request-album/);
  assert.match(web, /data-open-my-albums/);
});

test('approved Zwit logo is permanently available in the Web header', () => {
  assert.match(web, /zwit-global-brand/);
  assert.match(web, /data-zwit-global-brand/);
});
