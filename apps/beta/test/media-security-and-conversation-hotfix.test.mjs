import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../../../${path}`, import.meta.url), 'utf8');

test('web avatars are not covered and conversations open through the messages API', async () => {
  const [photoProtection, hotfix, html, worker] = await Promise.all([
    read('apps/beta/static/assets/photo-protection.js'),
    read('apps/beta/static/assets/velvet-mobile-feed-hotfix.js'),
    read('apps/web/velvet-members-beta-live.html'),
    read('apps/beta/static/sw.js')
  ]);

  assert.match(photoProtection, /conversation-avatar-v2/);
  assert.match(photoProtection, /feed-avatar/);
  assert.match(photoProtection, /marker\.textContent = 'V'/);
  assert.doesNotMatch(photoProtection, /VX-LOCAL|viewerCode/);
  assert.match(hotfix, /openConversationDirect/);
  assert.match(hotfix, /\/api\/members\/messages\?conversationId=/);
  assert.match(hotfix, /stopImmediatePropagation/);
  assert.match(hotfix, /menu\.inert = !open/);
  assert.match(html, /photo-protection\.js\?v=20260731-5/);
  assert.match(html, /velvet-mobile-feed-hotfix\.js\?v=20260731-5/);
  assert.match(worker, /velvet-beta-shell-v18/);
  assert.match(worker, /velvet-social-realtime\.js/);
});

test('native capture protection obscures recording and notifies both parties', async () => {
  const [root, app, entry, premiumDetail, socialGallery, endpoint, browserPush] = await Promise.all([
    read('ios/Velvet/App/RootView.swift'),
    read('ios/Velvet/VelvetApp.swift'),
    read('ios/Velvet/Features/Discovery/MemberDetailView.swift'),
    read('ios/Velvet/Features/Discovery/PremiumMemberDetailView.swift'),
    read('ios/Velvet/Features/Discovery/SocialMediaViews.swift'),
    read('functions/api/members/media-security-events.js'),
    read('functions/api/members/_browser-push.js')
  ]);

  assert.match(root, /UIApplication\.userDidTakeScreenshotNotification/);
  assert.match(root, /UIScreen\.capturedDidChangeNotification/);
  assert.match(root, /MediaCaptureShield/);
  assert.match(root, /Le propriétaire de la photo a été prévenu/);
  assert.match(app, /environmentObject\(screenshotProtection\)/);
  assert.match(entry, /PremiumMemberDetailView/);
  assert.match(premiumDetail, /screenshotProtection\.protect/);
  assert.match(premiumDetail, /screenshotProtection\.clear/);
  assert.match(premiumDetail, /SocialProfileGallery/);
  assert.match(socialGallery, /InteractiveMediaViewer/);
  assert.match(endpoint, /Capture d’écran détectée/);
  assert.match(endpoint, /Capture signalée/);
  assert.match(endpoint, /member_notifications/);
  assert.match(endpoint, /deliverBrowserActivity/);
  assert.match(endpoint, /eventType: 'security'/);
  assert.match(endpoint, /entity_type: 'security'/);
  assert.match(browserPush, /VAPID_PUBLIC_KEY/);
  assert.match(browserPush, /browser_push_subscriptions/);
});
