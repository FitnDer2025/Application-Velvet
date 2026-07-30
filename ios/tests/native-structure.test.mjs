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
    '/api/members/event-registrations',
    '/api/members/conversations',
    '/api/members/messages',
    '/api/members/social-actions',
    '/api/members/location',
    '/api/members/account-deletion'
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

test('les usages Apple sensibles sont documentés', async () => {
  const info = await readFile(resolve(root, 'Velvet/Resources/Info.plist'), 'utf8');
  const privacy = await readFile(resolve(root, 'Velvet/Resources/PrivacyInfo.xcprivacy'), 'utf8');
  assert.match(info, /NSLocationWhenInUseUsageDescription/);
  assert.match(info, /<string>velvet<\/string>/);
  assert.match(privacy, /NSPrivacyCollectedDataTypeSensitiveInfo/);
  assert.match(privacy, /NSPrivacyTracking[\s\S]*?<false\/>/);
});
