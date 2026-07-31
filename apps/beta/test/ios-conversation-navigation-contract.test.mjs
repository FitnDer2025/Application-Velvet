import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(path, 'utf8');

test('la fiche membre complète peut créer puis ouvrir une conversation native', async () => {
  const [entry, premiumDetail, appleMessaging, compatibility] = await Promise.all([
    read('ios/Velvet/Features/Discovery/MemberDetailView.swift'),
    read('ios/Velvet/Features/Discovery/PremiumMemberDetailView.swift'),
    read('ios/Velvet/Features/Messaging/AppleMessagingViews.swift'),
    read('ios/Velvet/Features/Messaging/ConversationView+Compatibility.swift')
  ]);

  assert.match(entry, /PremiumMemberDetailView\(profile:\s*profile\)/);
  assert.match(premiumDetail, /startConversation\(profileID:\s*profile\.id\)/);
  assert.match(premiumDetail, /activeConversation\s*=\s*\.direct\(/);
  assert.match(premiumDetail, /profileID:\s*profile\.id/);
  assert.match(premiumDetail, /AppleConversationView\(conversation:\s*activeConversation\)/);
  assert.match(appleMessaging, /let conversation:\s*Conversation/);

  // L’ancien initialiseur reste disponible pour les écrans ou branches encore en transition.
  assert.match(compatibility, /extension ConversationView/);
  assert.match(compatibility, /init\(conversationID:\s*UUID,\s*title:\s*String\)/);
});
