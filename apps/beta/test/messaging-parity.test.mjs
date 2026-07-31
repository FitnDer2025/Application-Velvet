import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const files = {
  directory: 'functions/api/members/directory.js',
  messages: 'functions/api/members/messages.js',
  notifications: 'functions/api/members/_message-notifications.js',
  web: 'apps/beta/static/assets/velvet-messaging-upgrade.js',
  webCss: 'apps/beta/static/assets/velvet-messaging-upgrade.css',
  iosModels: 'ios/Velvet/Core/Models/DirectoryModels.swift',
  iosStore: 'ios/Velvet/Core/Session/VelvetStore.swift',
  iosMessages: 'ios/Velvet/Features/Messaging/ConversationsView.swift',
  iosShell: 'ios/Velvet/Features/Home/MainShellView.swift'
};

async function source(name) {
  return readFile(files[name], 'utf8');
}

test('directory exposes participant identity, preview and unread state', async () => {
  const value = await source('directory');
  for (const contract of [
    'participant_display_name',
    'participant_photo_url',
    'last_message_body',
    'last_message_at',
    'unread_count',
    'messageUnreadCount'
  ]) {
    assert.match(value, new RegExp(contract));
  }
});

test('opening and sending messages update read state and notifications', async () => {
  const value = await source('messages');
  assert.match(value, /last_read_at/);
  assert.match(value, /deliverMessageNotifications/);
  assert.match(value, /messageRecipients/);
  assert.match(value, /waitUntil/);

  const notifier = await source('notifications');
  assert.match(notifier, /member_notifications/);
  assert.match(notifier, /member_push_devices/);
  assert.match(notifier, /browser_push_subscriptions/);
  assert.match(notifier, /api\.push\.apple\.com/);
  assert.match(notifier, /aes128gcm/);
});

test('Web messaging provides badges, participant cards, multiline input and menu recovery', async () => {
  const value = await source('web');
  assert.match(value, /velvet-message-badge/);
  assert.match(value, /participant_display_name/);
  assert.match(value, /document\.createElement\('textarea'\)/);
  assert.match(value, /send-label/);
  assert.match(value, /enrollWebPush/);
  assert.match(value, /stopImmediatePropagation/);
  assert.match(value, /velvet-mobile-menu-open/);

  const css = await source('webCss');
  assert.match(css, /\.messages \.message\.mine/);
  assert.match(css, /align-self:flex-end/);
  assert.match(css, /white-space:pre-wrap/);
});

test('iOS messaging shows unread badges and WhatsApp-style alignment', async () => {
  const models = await source('iosModels');
  assert.match(models, /participantDisplayName/);
  assert.match(models, /participantPhotoUrl/);
  assert.match(models, /lastMessageBody/);
  assert.match(models, /unreadCount/);

  const store = await source('iosStore');
  assert.match(store, /unreadMessageCount/);
  assert.match(store, /refreshMessaging/);

  const messages = await source('iosMessages');
  assert.match(messages, /ConversationAvatar/);
  assert.match(messages, /TextEditor\(text: \$draft\)/);
  assert.match(messages, /Text\("Envoyer"\)/);
  assert.match(messages, /if isMine \{ Spacer/);
  assert.match(messages, /if !isMine \{ Spacer/);

  const shell = await source('iosShell');
  assert.match(shell, /store\.unreadMessageCount/);
  assert.match(shell, /tab == \.messages/);
});
