import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(path, 'utf8');

test('la fiche membre peut ouvrir une conversation avec son identifiant', async () => {
  const [memberDetail, compatibility, conversations] = await Promise.all([
    read('ios/Velvet/Features/Discovery/MemberDetailView.swift'),
    read('ios/Velvet/Features/Messaging/ConversationView+Compatibility.swift'),
    read('ios/Velvet/Features/Messaging/ConversationsView.swift')
  ]);

  assert.match(memberDetail, /ConversationView\(conversationID:\s*conversationID,\s*title:\s*profile\.displayName\)/);
  assert.match(compatibility, /extension ConversationView/);
  assert.match(compatibility, /init\(conversationID:\s*UUID,\s*title:\s*String\)/);
  assert.match(compatibility, /self\.init\(\s*conversation:\s*Conversation\(/s);
  assert.match(compatibility, /participantDisplayName:\s*title/);
  assert.match(conversations, /let conversation:\s*Conversation/);
});
