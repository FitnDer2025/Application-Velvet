import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const requiredFiles = [
  'Velvet.xcodeproj/project.pbxproj',
  'Velvet/VelvetApp.swift',
  'Velvet/App/AppState.swift',
  'Velvet/App/RootView.swift',
  'Velvet/Core/Networking/APIClient.swift',
  'Velvet/Core/Session/SessionService.swift',
  'Velvet/DesignSystem/VelvetTokens.swift',
  'Velvet/Features/Authentication/LoginView.swift',
  'Velvet/Features/Authentication/SignUpView.swift',
  'Velvet/Features/Authentication/ForgotPasswordView.swift',
  'Velvet/Features/Authentication/ConsentView.swift',
  'Velvet/Features/Onboarding/OnboardingFlowView.swift',
  'Velvet/Features/Onboarding/ProfileSetupView.swift',
  'Velvet/Features/Home/HomeView.swift',
  'Velvet/Features/Discovery/DiscoveryView.swift',
  'Velvet/Features/Places/MemberMapView.swift',
  'Velvet/Features/Places/PlacesEventsView.swift',
  'Velvet/Features/Messaging/ConversationsView.swift',
  'Velvet/Features/Safety/SafetyActionsView.swift',
  'Velvet/Core/System/StoreKitService.swift',
  'Velvet/Core/System/LocationService.swift',
  'Velvet/Core/System/BiometricLockService.swift',
  'Velvet/Core/System/NotificationService.swift',
  'Velvet/Core/Models/ParityModels.swift',
  'Velvet/Features/Profile/MemberToolsView.swift',
  'Velvet/Features/Profile/AlbumManagerView.swift',
  'Velvet/Features/Places/AgendaView.swift',
  'Velvet/Features/Places/VenueDetailView.swift',
  'Velvet/Resources/Info.plist',
  'Velvet/Resources/Velvet.entitlements',
  'Velvet/Resources/PrivacyInfo.xcprivacy',
  'Velvet/Resources/Assets.xcassets/AppIcon.appiconset/Contents.json'
];

for (const file of requiredFiles) {
  const result = await stat(resolve(root, file));
  assert(result.isFile(), `${file} doit être un fichier`);
}

const project = await readFile(resolve(root, 'Velvet.xcodeproj/project.pbxproj'), 'utf8');
assert.match(project, /productType = "com\.apple\.product-type\.application"/);
assert.match(project, /IPHONEOS_DEPLOYMENT_TARGET = 17\.0/);
assert.match(project, /PRODUCT_BUNDLE_IDENTIFIER = com\.velvetapplication\.app/);
assert.match(project, /INFOPLIST_FILE = Velvet\/Resources\/Info\.plist/);

const tokens = await readFile(resolve(root, 'Velvet/DesignSystem/VelvetTokens.swift'), 'utf8');
for (const color of ['0x0B080A', '0x7E2045', '0xD9B879', '0xF6EEE6']) {
  assert(tokens.includes(color), `Le token ${color} doit rester synchronisé`);
}

const debugConfig = await readFile(resolve(root, 'Config/Debug.xcconfig'), 'utf8');
assert.match(debugConfig, /velvet-beta\.sh96hv64dj\.workers\.dev/);

const session = await readFile(resolve(root, 'Velvet/Core/Session/SessionService.swift'), 'utf8');
for (const endpoint of [
  '/api/auth/signup',
  '/api/auth/recovery-request',
  '/api/members/photos',
  '/api/members/directory',
  '/api/members/discovery',
  '/api/members/map',
  '/api/members/messages',
  '/api/members/social-actions',
  '/api/members/account-deletion',
  '/api/members/account-actions',
  '/api/members/album-access',
  '/api/members/album-media',
  '/api/members/albums',
  '/api/members/engagement',
  '/api/members/organizer-request',
  '/api/members/photo-reactions',
  '/api/members/plans',
  '/api/members/profile-copy',
  '/api/members/push-devices',
  '/api/members/settings',
  '/api/members/venue-relationships'
]) {
  assert(session.includes(endpoint), `${endpoint} doit rester relié au client natif`);
}

const plist = await readFile(resolve(root, 'Velvet/Resources/Info.plist'), 'utf8');
assert.match(plist, /<string>velvet<\/string>/);
assert.match(plist, /NSLocationWhenInUseUsageDescription/);
assert.match(plist, /NSFaceIDUsageDescription/);

const projectEntitlements = await readFile(
  resolve(root, 'Velvet/Resources/Velvet.entitlements'),
  'utf8'
);
assert.match(projectEntitlements, /aps-environment/);
assert.match(project, /CODE_SIGN_ENTITLEMENTS = Velvet\/Resources\/Velvet\.entitlements/);

const swiftFiles = requiredFiles.filter((file) => file.endsWith('.swift'));
for (const file of swiftFiles) {
  const source = await readFile(resolve(root, file), 'utf8');
  assert(!source.includes('PlaceholderDestination'), `${file} contient encore un écran placeholder`);
}

console.log('Velvet iOS: structure et contrats natifs validés.');
