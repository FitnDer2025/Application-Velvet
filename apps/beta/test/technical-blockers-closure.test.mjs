import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  callbackCanonicalPayload,
  signCallbackPayload
} from '../../../functions/api/members/verification.js';
import {
  internalRecipeBypass,
  memberSession,
  verificationGateEnabled
} from '../../../functions/api/members/_shared.js';
import {
  backupKey,
  connectionFingerprint,
  decryptBackup,
  encryptBackup
} from '../../../scripts/ops/backup-format.mjs';

const read = (path) => readFile(path, 'utf8');

function accessCookie(userId) {
  const payload = Buffer.from(JSON.stringify({
    sub: userId,
    email: 'recipe@velvet.test',
    exp: Math.floor(Date.now() / 1000) + 1800
  })).toString('base64url');
  return `velvet_beta_access=x.${payload}.x`;
}

test('le verrou majorité est central, explicite et laisse seulement les parcours de conformité', async () => {
  const [shared, profile, settings, exportEndpoint, verification, worker, ui] = await Promise.all([
    read('functions/api/members/_shared.js'),
    read('functions/api/members/profile.js'),
    read('functions/api/members/settings.js'),
    read('functions/api/members/data-export.js'),
    read('functions/api/members/verification.js'),
    read('apps/beta/worker/index.js'),
    read('apps/beta/static/assets/members-live.js')
  ]);
  assert.match(shared, /IDENTITY_AGE_VERIFICATION_REQUIRED/);
  assert.match(shared, /identity_age_verification_required/);
  assert.match(shared, /VELVET_INTERNAL_RECIPE_USER_IDS/);
  assert.match(profile, /allowUnverified: true/);
  assert.match(settings, /allowUnverified: true/);
  assert.match(exportEndpoint, /allowUnverified: true/);
  assert.match(verification, /allowUnverified: true/);
  assert.match(verification, /!path\.startsWith\('\/\/'\)/);
  assert.match(verification, /startUrl\.protocol !== 'https:'/);
  assert.match(worker, /POST \/api\/members\/data-export/);
  assert.match(ui, /accessBlockedByVerification/);
  assert.match(ui, /renderVerificationGate/);
});

test('une session active non vérifiée reçoit réellement un refus 403', async () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const path = new URL(url).pathname;
    if (path.endsWith('/accounts')) return Response.json([{ user_id: userId, status: 'active', invited_role: 'member' }]);
    if (path.endsWith('/account_roles')) return Response.json([{ role_code: 'member' }]);
    if (path.endsWith('/account_identity_age_verifications')) return Response.json([]);
    return Response.json({ ok: true });
  };
  try {
    const access = await memberSession(
      new Request('https://velvet.test/api/members/directory', { headers: { cookie: accessCookie(userId) } }),
      {
        SUPABASE_URL: 'https://supabase.velvet.test',
        SUPABASE_PUBLISHABLE_KEY: 'publishable-test-key',
        IDENTITY_AGE_VERIFICATION_REQUIRED: 'true'
      }
    );
    assert.equal(access.response.status, 403);
    assert.equal((await access.response.json()).error, 'identity_age_verification_required');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('l’exception de recette est fermée par défaut et nominative', () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  assert.equal(verificationGateEnabled({ IDENTITY_AGE_VERIFICATION_REQUIRED: 'required' }), true);
  assert.equal(internalRecipeBypass({ VELVET_RUNTIME_MODE: 'production', VELVET_INTERNAL_RECIPE_USER_IDS: userId }, userId), false);
  assert.equal(internalRecipeBypass({ VELVET_RUNTIME_MODE: 'internal_recipe', VELVET_INTERNAL_RECIPE_USER_IDS: userId }, userId), true);
  assert.equal(internalRecipeBypass({ VELVET_RUNTIME_MODE: 'internal_recipe', VELVET_INTERNAL_RECIPE_USER_IDS: userId }, '22222222-2222-4222-8222-222222222222'), false);
});

test('la signature du callback 18+ couvre tous les champs et change au moindre résultat', async () => {
  const payload = {
    state: 'state_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    result: 'verified',
    identityVerified: true,
    majorityVerified: true,
    reference: 'opaque-provider-reference',
    expiresAt: '2027-08-03T12:00:00.000Z',
    eventId: 'event-1',
    issuedAt: '2026-08-03T12:00:00.000Z'
  };
  const canonical = callbackCanonicalPayload(payload);
  assert.equal(canonical.split('\n').length, 8);
  const signature = await signCallbackPayload('test-secret-only', payload);
  const altered = await signCallbackPayload('test-secret-only', { ...payload, majorityVerified: false });
  assert.match(signature, /^[0-9a-f]{64}$/);
  assert.notEqual(signature, altered);
});

test('le format de sauvegarde chiffre, authentifie et détecte toute altération', () => {
  const key = backupKey(randomBytes(32).toString('base64'));
  const plain = Buffer.from('Zwit backup recipe payload');
  const payload = encryptBackup(plain, key, { source_fingerprint: 'source-test' });
  const restored = decryptBackup(payload, key);
  assert.deepEqual(restored.plain, plain);
  assert.equal(restored.header.source_fingerprint, 'source-test');
  const altered = Buffer.from(payload);
  altered[altered.length - 1] ^= 1;
  assert.throws(() => decryptBackup(altered, key));
});

test('la restauration peut comparer les cibles sans exposer leurs identifiants', () => {
  const first = connectionFingerprint('postgresql://user:secret@localhost:5432/velvet_source');
  const second = connectionFingerprint('postgresql://other:other@localhost:5432/velvet_source');
  const recipe = connectionFingerprint('postgresql://user:secret@localhost:5432/velvet_recipe');
  assert.equal(first, second);
  assert.notEqual(first, recipe);
  assert.doesNotMatch(first, /velvet|secret|localhost/);
});

test('la portabilité exclut les secrets de vérification et les chemins média directs', async () => {
  const source = await read('functions/api/members/data-export.js');
  assert.match(source, /provider_reference_included: false/);
  assert.match(source, /identity_documents_included: false/);
  assert.match(source, /cache-control': 'no-store, private/);
  assert.match(source, /download_url/);
  assert.match(source, /storage_path: ignoredStoragePath/);
  assert.doesNotMatch(source, /provider_reference_hash[^']*'/);
});

test('la CSP runtime refuse eval et les images externes non maîtrisées', async () => {
  const [worker, headers] = await Promise.all([
    read('apps/beta/worker/index.js'),
    read('apps/beta/static/_headers')
  ]);
  for (const source of [worker, headers]) {
    assert.doesNotMatch(source, /unsafe-eval/);
    assert.doesNotMatch(source, /images\.unsplash\.com/);
  }
});
