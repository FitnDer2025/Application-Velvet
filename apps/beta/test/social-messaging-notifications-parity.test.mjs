import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(path, 'utf8');

test('la migration sociale suit livraison lecture réactions saisie et archives', async () => {
  const migration = await read('supabase/migrations/20260731211500_social_messaging_notifications.sql');
  assert.match(migration, /last_delivered_at timestamptz/);
  assert.match(migration, /archived_at timestamptz/);
  assert.match(migration, /metadata jsonb/);
  assert.match(migration, /create table if not exists public\.message_reactions/);
  assert.match(migration, /create table if not exists public\.conversation_typing/);
  assert.match(migration, /unique \(message_id, user_id\)/);
  assert.match(migration, /conversation_members_self_receipts/);
  assert.match(migration, /grant select, insert, update, delete/);
  assert.match(migration, /enable row level security/);
});

test('le backend des messages expose les états par personne et les interactions temps réel', async () => {
  const [messages, notifier] = await Promise.all([
    read('functions/api/members/messages.js'),
    read('functions/api/members/_message-notifications.js')
  ]);
  assert.match(messages, /payload\.action === 'typing'/);
  assert.match(messages, /payload\.action === 'delivered'/);
  assert.match(messages, /payload\.action === 'read'/);
  assert.match(messages, /payload\.action === 'reaction'/);
  assert.match(messages, /displayIdentity/);
  assert.match(messages, /receiptsByMessage/);
  assert.match(messages, /status: read \? 'read' : \(delivered \? 'delivered' : 'sent'\)/);
  assert.match(messages, /consumeConversationNotifications/);
  assert.match(messages, /sender_identity/);
  assert.match(notifier, /senderIdentity/);
  assert.match(notifier, /browser_enabled !== false/);
  assert.match(notifier, /webPushSent/);
});

test('le centre d’activité enrichit les photos et archive les éléments consommés', async () => {
  const [notifications, reactions] = await Promise.all([
    read('functions/api/members/notifications.js'),
    read('functions/api/members/photo-reactions.js')
  ]);
  assert.match(notifications, /searchParams\.get\('archived'\) === '1'/);
  assert.match(notifications, /entityPreviewUrl/);
  assert.match(notifications, /actorPreviewUrl/);
  assert.match(notifications, /consume_entity/);
  assert.match(notifications, /archive_all/);
  assert.match(notifications, /archived_at: now/);
  assert.match(reactions, /metadata:/);
  assert.match(reactions, /mediaId/);
  assert.match(reactions, /reaction/);
});

test('le Web et la PWA affichent accusés réactions saisie historique et push hors page', async () => {
  const [html, realtime, reconcile, deepLink, styles, worker] = await Promise.all([
    read('apps/web/velvet-members-beta-live.html'),
    read('apps/beta/static/assets/velvet-social-realtime.js'),
    read('apps/beta/static/assets/velvet-realtime-reconcile.js'),
    read('apps/beta/static/assets/velvet-push-deeplink.js'),
    read('apps/beta/static/assets/velvet-social-realtime.css'),
    read('apps/beta/static/sw.js')
  ]);
  assert.match(html, /velvet-social-realtime\.js/);
  assert.match(html, /velvet-realtime-reconcile\.js/);
  assert.match(html, /velvet-push-deeplink\.js/);
  assert.match(realtime, /Lu par/);
  assert.match(realtime, /Distribué à/);
  assert.match(realtime, /velvet-message-reaction-picker/);
  assert.match(realtime, /velvet-typing-indicator/);
  assert.match(realtime, /requestPermission/);
  assert.match(realtime, /pushManager\.subscribe/);
  assert.match(realtime, /velvet-profile-viewed-v2/);
  assert.match(realtime, /Profils consultés/);
  assert.match(reconcile, /reconcileConversation/);
  assert.match(reconcile, /reconcileNotifications/);
  assert.match(deepLink, /URLSearchParams/);
  assert.match(deepLink, /data-open-conversation/);
  assert.match(deepLink, /data-open-profile/);
  assert.match(styles, /\.velvet-notification-entity-preview/);
  assert.match(styles, /\.velvet-view-history-v2/);
  assert.match(worker, /velvet-beta-shell-v16/);
  assert.match(worker, /velvet-push-deeplink\.js/);
  assert.match(worker, /self\.addEventListener\('push'/);
  assert.match(worker, /notificationclick/);
  assert.match(worker, /conversationId/);
});

test('iOS utilise le même état temps réel et archive les notifications', async () => {
  const [models, service, store, messaging, shell, notifications, memberDetail, discovery] = await Promise.all([
    read('ios/Velvet/Core/Models/DirectoryModels.swift'),
    read('ios/Velvet/Core/Session/SessionService+IOSSocial.swift'),
    read('ios/Velvet/Core/Session/VelvetStore.swift'),
    read('ios/Velvet/Features/Messaging/RealtimeAppleMessagingViews.swift'),
    read('ios/Velvet/Features/Home/MainShellView.swift'),
    read('ios/Velvet/Features/Home/NotificationsView.swift'),
    read('ios/Velvet/Features/Discovery/MemberDetailView.swift'),
    read('ios/Velvet/Features/Discovery/PremiumDiscoveryGridView.swift')
  ]);
  assert.match(models, /struct MessageReceipt/);
  assert.match(models, /struct MessageReaction/);
  assert.match(models, /struct TypingParticipant/);
  assert.match(models, /struct NotificationMetadata/);
  assert.match(service, /setConversationTyping/);
  assert.match(service, /setMessageReaction/);
  assert.match(service, /archivedNotifications/);
  assert.match(store, /messageReceipts/);
  assert.match(store, /typingParticipants/);
  assert.match(store, /viewedProfiles/);
  assert.match(messaging, /Lu par/);
  assert.match(messaging, /Distribué à/);
  assert.match(messaging, /contextMenu/);
  assert.match(messaging, /composerIdentity = UUID\(\)/);
  assert.match(messaging, /setTyping/);
  assert.match(shell, /RealtimeAppleConversationsView/);
  assert.match(shell, /RealtimeAppleConversationView/);
  assert.match(notifications, /Tout archiver/);
  assert.match(notifications, /NotificationActivityTab/);
  assert.match(notifications, /entityPreviewUrl/);
  assert.match(notifications, /Profils consultés/);
  assert.match(memberDetail, /Déjà consulté/);
  assert.match(discovery, /store\.viewHistory/);
  assert.ok(discovery.includes('Vu \\(history.viewCount'));
  assert.match(discovery, /eye\.fill/);
});
