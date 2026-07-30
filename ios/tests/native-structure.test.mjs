import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');

test('les écrans natifs utilisent les contrats backend existants', async () => {
  const source = await readFile(
    resolve(root, 'Velvet/Core/Session/SessionService.swift'),
    'utf8'
  );
  const contracts = [
    '/api/auth/signup',
    '/api/auth/recovery-request',
    '/api/auth/password-update',
    '/api/members/couple-invite',
    '/api/members/photos',
    '/api/members/verification',
    '/api/members/directory',
    '/api/members/discovery',
    '/api/members/map',
    '/api/members/event-registrations',
    '/api/members/conversations',
    '/api/members/messages',
    '/api/members/social-actions',
    '/api/members/location',
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
  ];
  for (const contract of contracts) {
    assert(source.includes(contract), `contrat manquant : ${contract}`);
  }
});

test('aucun secret serveur évident n’est embarqué dans le projet iOS', async () => {
  const files = [
    'Velvet/Core/Networking/APIClient.swift',
    'Velvet/Core/Session/SessionService.swift',
    'Config/Debug.xcconfig',
    'Config/Release.xcconfig'
  ];
  for (const file of files) {
    const source = await readFile(resolve(root, file), 'utf8');
    assert(!/SUPABASE_SERVICE_ROLE_KEY\s*=/.test(source));
    assert(!/sk_live_[A-Za-z0-9]+/.test(source));
    assert(!/BEGIN (RSA |EC )?PRIVATE KEY/.test(source));
  }
});

test('les corps JSON conservent le camelCase attendu par les handlers Web', async () => {
  const client = await readFile(
    resolve(root, 'Velvet/Core/Networking/APIClient.swift'),
    'utf8'
  );
  const session = await readFile(
    resolve(root, 'Velvet/Core/Session/SessionService.swift'),
    'utf8'
  );
  assert.match(client, /keyEncodingStrategy = \.useDefaultKeys/);
  assert.match(session, /"discoverable_by"/);
  assert.match(session, /"album_access"/);
});

test('les usages Apple sensibles sont documentés', async () => {
  const info = await readFile(resolve(root, 'Velvet/Resources/Info.plist'), 'utf8');
  const privacy = await readFile(resolve(root, 'Velvet/Resources/PrivacyInfo.xcprivacy'), 'utf8');
  assert.match(info, /NSLocationWhenInUseUsageDescription/);
  assert.match(info, /NSFaceIDUsageDescription/);
  assert.match(info, /<string>velvet<\/string>/);
  assert.match(privacy, /NSPrivacyCollectedDataTypeSensitiveInfo/);
  assert.match(privacy, /NSPrivacyTracking[\s\S]*?<false\/>/);
});

test('Face ID et APNs sont intégrés sans secret côté client', async () => {
  const biometric = await readFile(
    resolve(root, 'Velvet/Core/System/BiometricLockService.swift'),
    'utf8'
  );
  const notifications = await readFile(
    resolve(root, 'Velvet/Core/System/NotificationService.swift'),
    'utf8'
  );
  const entitlements = await readFile(
    resolve(root, 'Velvet/Resources/Velvet.entitlements'),
    'utf8'
  );
  assert.match(biometric, /LocalAuthentication/);
  assert.match(biometric, /deviceOwnerAuthentication/);
  assert.match(notifications, /registerForRemoteNotifications/);
  assert.match(notifications, /UNUserNotificationCenterDelegate/);
  assert.match(entitlements, /aps-environment/);
  assert(!notifications.includes('BEGIN PRIVATE KEY'));
});

test('la navigation, les filtres et la fiche profil restent alignés sur le Web', async () => {
  const shell = await readFile(
    resolve(root, 'Velvet/Features/Home/MainShellView.swift'),
    'utf8'
  );
  const discovery = await readFile(
    resolve(root, 'Velvet/Features/Discovery/DiscoveryView.swift'),
    'utf8'
  );
  const profile = await readFile(
    resolve(root, 'Velvet/Features/Home/ProfileSummaryView.swift'),
    'utf8'
  );

  assert.match(shell, /magnifyingglass\.circle\.fill/);
  assert.match(shell, /case directory[\s\S]*case agenda/);
  for (const filter of [
    'Qui recherchent',
    'Pratiques',
    'Physique',
    'Avec photos publiques',
    'Avec recommandation'
  ]) {
    assert(discovery.includes(filter), `filtre manquant : ${filter}`);
  }
  for (const section of [
    'Notre histoire',
    'Ce que nous recherchons',
    'Pratiques & expériences',
    'Albums publics & privés'
  ]) {
    assert(profile.includes(section), `section profil manquante : ${section}`);
  }
});
