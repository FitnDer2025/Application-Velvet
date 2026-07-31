import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const files = {
  shell: 'ios/Velvet/Features/Home/MainShellView.swift',
  shellComponents: 'ios/Velvet/DesignSystem/AppleShellComponents.swift',
  discovery: 'ios/Velvet/Features/Discovery/PremiumDiscoveryGridView.swift',
  messaging: 'ios/Velvet/Features/Messaging/AppleMessagingViews.swift',
  ownProfile: 'ios/Velvet/Features/Profile/PremiumOwnProfileView.swift',
  editor: 'ios/Velvet/Features/Profile/ProfileEditorView.swift',
  memberDetail: 'ios/Velvet/Features/Discovery/PremiumMemberDetailView.swift',
  detailEntry: 'ios/Velvet/Features/Discovery/MemberDetailView.swift'
};

async function source(name) {
  return readFile(files[name], 'utf8');
}

test('iOS shell uses compact header and translucent Apple-style dock', async () => {
  const shell = await source('shell');
  const components = await source('shellComponents');
  assert.match(shell, /CompactVelvetTopBar/);
  assert.match(shell, /PremiumDiscoveryGridView/);
  assert.match(shell, /AppleConversationsView/);
  assert.match(shell, /PremiumOwnProfileView/);
  assert.match(shell, /Studio du profil & Velvet IA/);
  assert.match(shell, /Modifier mon profil/);
  assert.match(shell, /Paramètres & confidentialité/);
  assert.match(shell, /\.ultraThinMaterial/);
  assert.match(components, /ShellChromeState/);
  assert.match(components, /Femme seule/);
  assert.match(components, /Homme seul/);
});

test('iOS discovery displays compact 3-column member cards and nine-item pagination', async () => {
  const value = await source('discovery');
  assert.match(value, /count: 3/);
  assert.match(value, /visibleCount = 9/);
  assert.match(value, /Afficher 9 profils de plus/);
  assert.match(value, /CompactMemberCard/);
  assert.match(value, /profile\.velvetAudienceLabel/);
  assert.match(value, /PremiumDiscoveryFiltersView/);
});

test('iOS messaging uses immersive iMessage-style navigation without private label', async () => {
  const value = await source('messaging');
  assert.match(value, /AppleConversationView/);
  assert.match(value, /chevron\.left/);
  assert.match(value, /chrome\.isImmersive = true/);
  assert.match(value, /safeAreaInset\(edge: \.bottom/);
  assert.match(value, /TextEditor\(text: \$draft\)/);
  assert.doesNotMatch(value, /ÉCHANGE PRIVÉ/);
  assert.doesNotMatch(value, /CONVERSATION PRIVÉE/);
});

test('own profile no longer duplicates profile photos as a system album', async () => {
  const value = await source('ownProfile');
  assert.match(value, /profile\.albums/);
  assert.match(value, /Les photos de profil restent dans le carrousel principal/);
  assert.doesNotMatch(value, /Photos de profil/);
});

test('profile editing and Velvet AI are directly available in native iOS', async () => {
  const editor = await source('editor');
  assert.match(editor, /Modifier mon profil/);
  assert.match(editor, /Velvet IA/);
  assert.match(editor, /generateProfileCopy/);
  assert.match(editor, /saveProfile/);
  assert.match(editor, /ProfileUpsertRequest/);
});

test('member detail exposes full profile, people, photos, albums and actions', async () => {
  const detail = await source('memberDetail');
  const entry = await source('detailEntry');
  for (const contract of [
    'VelvetProfileGallery',
    'Leur univers',
    'Leur histoire',
    'Ce qu’ils recherchent',
    'Pratiques & expériences',
    'Derrière ce profil',
    'Albums du profil',
    'Écrire un message',
    'Partager un album privé',
    'Sécurité, blocage et signalement'
  ]) {
    assert.match(detail, new RegExp(contract));
  }
  assert.match(entry, /PremiumMemberDetailView/);
});
