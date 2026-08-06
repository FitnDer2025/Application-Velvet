import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const web = await readFile(new URL('apps/beta/static/assets/zwit-experience.js', root), 'utf8');
const messaging = await readFile(new URL('ios/Velvet/Features/Messaging/RealtimeAppleMessagingViews.swift', root), 'utf8');
const profile = await readFile(new URL('ios/Velvet/Features/Discovery/PremiumMemberDetailView.swift', root), 'utf8');
const launch = await readFile(new URL('ios/Velvet/App/RootView.swift', root), 'utf8');

test('Zwit opening is multilingual and discreet', () => {
  assert.match(web, /Chut/);
  assert.match(web, /Silencio/);
  assert.match(web, /静かに/);
  assert.match(launch, /Un secret se partage/);
});

test('messages expose day separators and swipe dates', () => {
  assert.match(messaging, /RealtimeMessageDaySeparator/);
  assert.match(messaging, /DragGesture/);
  assert.match(web, /zwit-day-separator/);
});

test('member profiles expose both album actions', () => {
  assert.match(profile, /Demander l’ouverture d’un album/);
  assert.match(profile, /Ouvrir mes albums privés/);
  assert.match(web, /data-request-album/);
  assert.match(web, /data-open-my-albums/);
});
