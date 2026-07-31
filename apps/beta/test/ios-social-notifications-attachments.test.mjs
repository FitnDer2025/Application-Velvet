import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(path, 'utf8');

test('home and discovery expose precise audience and age', async () => {
  const [presentation, home, discovery] = await Promise.all([
    read('ios/Velvet/Core/Models/MemberProfilePresentation.swift'),
    read('ios/Velvet/Features/Home/PremiumHomeCards.swift'),
    read('ios/Velvet/Features/Discovery/PremiumDiscoveryGridView.swift')
  ]);
  assert.match(presentation, /velvetDemographicAndAgeLabel/);
  assert.match(presentation, /profileGalleryPhotos/);
  assert.match(home, /velvetDemographicAndAgeLabel/);
  assert.match(discovery, /velvetAgeLabel/);
});

test('native messaging uploads photos, videos and PDFs through multipart API', async () => {
  const [client, service, messaging, models] = await Promise.all([
    read('ios/Velvet/Core/Networking/APIClient.swift'),
    read('ios/Velvet/Core/Session/SessionService+IOSSocial.swift'),
    read('ios/Velvet/Features/Messaging/AppleMessagingViews.swift'),
    read('ios/Velvet/Core/Models/DirectoryModels.swift')
  ]);
  assert.match(client, /func upload/);
  assert.match(service, /MultipartPart/);
  assert.match(service, /"attachments"/);
  assert.match(service, /\/api\/members\/messages/);
  assert.match(models, /OutgoingMessageAttachment/);
  assert.match(messaging, /\.photosPicker/);
  assert.match(messaging, /\.fileImporter/);
  assert.match(messaging, /application\/pdf/);
  assert.match(messaging, /50 \* 1024 \* 1024/);
});

test('conversation streaks and profile affinity are restored from engagement', async () => {
  const [models, store, messaging, social] = await Promise.all([
    read('ios/Velvet/Core/Models/DirectoryModels.swift'),
    read('ios/Velvet/Core/Session/VelvetStore.swift'),
    read('ios/Velvet/Features/Messaging/AppleMessagingViews.swift'),
    read('ios/Velvet/Features/Discovery/SocialMediaViews.swift')
  ]);
  assert.match(models, /ConversationStreak/);
  assert.match(models, /ProfileEngagementReaction/);
  assert.match(store, /conversationStreaks/);
  assert.match(store, /profileReactionValue/);
  assert.match(messaging, /flame\.fill/);
  assert.match(social, /❄️/);
  assert.match(social, /🔥🔥🔥/);
});

test('notifications identify their actor, route to their origin and clear unread state', async () => {
  const [models, store, view, shell, endpoint, messageNotifier, engagement] = await Promise.all([
    read('ios/Velvet/Core/Models/DirectoryModels.swift'),
    read('ios/Velvet/Core/Session/VelvetStore.swift'),
    read('ios/Velvet/Features/Home/NotificationsView.swift'),
    read('ios/Velvet/Features/Home/MainShellView.swift'),
    read('functions/api/members/notifications.js'),
    read('functions/api/members/_message-notifications.js'),
    read('functions/api/members/engagement.js')
  ]);
  assert.match(models, /actorProfileId/);
  assert.match(store, /markNotificationRead/);
  assert.match(store, /setBadgeCount/);
  assert.match(view, /Tout lire/);
  assert.match(view, /onDestination/);
  assert.match(view, /VelvetNotificationDestination/);
  assert.match(view, /actorProfile/);
  assert.match(view, /profile_views/);
  assert.match(view, /security/);
  assert.doesNotMatch(view, /navigationDestination/);
  assert.match(shell, /routedConversation/);
  assert.match(shell, /routedProfile/);
  assert.match(shell, /openPendingNotificationDestination/);
  assert.match(endpoint, /read_all/);
  assert.match(endpoint, /notificationId/);
  assert.match(messageNotifier, /senderProfileId/);
  assert.match(engagement, /a consulté votre profil/);
  assert.match(engagement, /event_type: 'profile_views'/);
});

test('member photos and albums open full-screen with per-photo reactions', async () => {
  const [detail, social, reactions] = await Promise.all([
    read('ios/Velvet/Features/Discovery/PremiumMemberDetailView.swift'),
    read('ios/Velvet/Features/Discovery/SocialMediaViews.swift'),
    read('functions/api/members/photo-reactions.js')
  ]);
  assert.match(detail, /InteractiveAlbumDetailView/);
  assert.match(detail, /SocialProfileGallery/);
  assert.match(social, /InteractiveMediaViewer/);
  assert.match(social, /PhotoReactionBar/);
  assert.match(social, /setPhotoReaction/);
  assert.match(reactions, /notifyPhotoOwner/);
  assert.match(reactions, /event_type: 'reactions'/);
});
