import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const files = {
  shell: 'ios/Velvet/Features/Home/MainShellView.swift',
  shellComponents: 'ios/Velvet/DesignSystem/AppleShellComponents.swift',
  presentation: 'ios/Velvet/Core/Models/MemberProfilePresentation.swift',
  discovery: 'ios/Velvet/Features/Discovery/PremiumDiscoveryGridView.swift',
  messaging: 'ios/Velvet/Features/Messaging/AppleMessagingViews.swift',
  ownProfile: 'ios/Velvet/Features/Profile/PremiumOwnProfileView.swift',
  editor: 'ios/Velvet/Features/Profile/ProfileEditorView.swift',
  memberDetail: 'ios/Velvet/Features/Discovery/PremiumMemberDetailView.swift',
  socialMedia: 'ios/Velvet/Features/Discovery/SocialMediaViews.swift',
  detailEntry: 'ios/Velvet/Features/Discovery/MemberDetailView.swift'
};

async function source(name) {
  return readFile(files[name], 'utf8');
}

test('iOS shell uses compact header and translucent Apple-style dock', async () => {
  const shell = await source('shell');
  const components = await source('shellComponents');
  const presentation = await source('presentation');
  assert.match(shell, /CompactVelvetTopBar/);
  assert.match(shell, /PremiumDiscoveryGridView/);
  assert.match(shell, /ManagedConversationsView/);
  assert.match(shell, /PremiumOwnProfileView/);
  assert.match(shell, /Studio du profil & Velvet IA/);
  assert.match(shell, /Modifier mon profil/);
  assert.match(shell, /Paramètres & confidentialité/);
  assert.match(shell, /\.ultraThinMaterial/);
  assert.match(components, /ShellChromeState/);
  assert.match(presentation, /Femme seule/);
  assert.match(presentation, /Homme seul/);
  assert.match(presentation, /velvetAgeLabel/);
});

test('iOS discovery displays age, compact 3-column cards and nine-item pagination', async () => {
  const value = await source('discovery');
  assert.match(value, /count: 3/);
  assert.match(value, /visibleCount = 9/);
  assert.match(value, /Afficher 9 profils de plus/);
  assert.match(value, /CompactMemberCard/);
  assert.match(value, /profile\.velvetDemographicLabel/);
  assert.match(value, /profile\.velvetAgeLabel/);
  assert.match(value, /PremiumDiscoveryFiltersView/);
});

test('iOS messaging uses immersive iMessage navigation, attachments and streaks', async () => {
  const value = await source('messaging');
  assert.match(value, /AppleConversationView/);
  assert.match(value, /chevron\.left/);
  assert.match(value, /chrome\.isImmersive = true/);
  assert.match(value, /safeAreaInset\(edge: \.bottom/);
  assert.match(value, /TextEditor\(text: \$draft\)/);
  assert.match(value, /PhotosPickerItem/);
  assert.match(value, /fileImporter/);
  assert.match(value, /OutgoingMessageAttachment/);
  assert.match(value, /currentStreak/);
  assert.match(value, /flame\.fill/);
  assert.doesNotMatch(value, /ÉCHANGE PRIVÉ/);
  assert.doesNotMatch(value, /CONVERSATION PRIVÉE/);
});

test('own profile reloads albums and does not duplicate album media in the hero', async () => {
  const ownProfile = await source('ownProfile');
  const presentation = await source('presentation');
  assert.match(ownProfile, /currentProfile\.albums/);
  assert.match(ownProfile, /reloadProfile/);
  assert.match(ownProfile, /profileGalleryPhotos/);
  assert.match(ownProfile, /COLLECTIONS PUBLIQUES ET PRIVÉES/);
  assert.match(presentation, /!role\.contains\("album"\)/);
  assert.doesNotMatch(ownProfile, /Photos de profil/);
});

test('profile editing and Velvet AI are directly available in native iOS', async () => {
  const editor = await source('editor');
  assert.match(editor, /Modifier mon profil/);
  assert.match(editor, /Velvet IA/);
  assert.match(editor, /generateProfileCopy/);
  assert.match(editor, /saveProfile/);
  assert.match(editor, /ProfileUpsertRequest/);
});

test('member detail exposes full profile, interactive albums and affinity memory', async () => {
  const detail = await source('memberDetail');
  const social = await source('socialMedia');
  const entry = await source('detailEntry');
  for (const contract of [
    'SocialProfileGallery',
    'memberUniverseTitle',
    'memberStoryTitle',
    'memberSearchTitle',
    'Pratiques & expériences',
    'Albums du profil',
    'InteractiveAlbumDetailView',
    'ProfileAffinityBar',
    'Écrire un message',
    'Partager un album privé',
    'Sécurité, blocage et signalement'
  ]) {
    assert.match(detail, new RegExp(contract));
  }
  assert.match(social, /Pas pour moi/);
  assert.match(social, /J’aime beaucoup/);
  assert.match(social, /J’adore/);
  assert.match(social, /PhotoReactionBar/);
  assert.match(social, /InteractiveMediaViewer/);
  assert.match(entry, /PremiumMemberDetailView/);
});
