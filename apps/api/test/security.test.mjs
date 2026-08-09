import assert from 'node:assert/strict';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import test from 'node:test';
import { createEncryptor } from '../src/security/encryption.mjs';
import { hashPassword, normalizeEmail, validatePassword, verifyPassword } from '../src/security/password.mjs';
import { createAccessToken, createRefreshToken, hashRefreshToken, verifyAccessToken } from '../src/security/tokens.mjs';
import { hasAnyRole, requireAnyRole, ROLES } from '../src/security/rbac.mjs';
import { createRateLimiter, parseCookies } from '../src/http.mjs';

test('normalizes email without altering its semantic value', () => {
  assert.equal(normalizeEmail('  Cyril@Example.COM '), 'cyril@example.com');
});

test('enforces the password policy', () => {
  assert.equal(validatePassword('short').valid, false);
  assert.equal(validatePassword('Velvet-Strong-2026').valid, true);
});

test('hashes and verifies a password with scrypt and a pepper', async () => {
  const pepper = randomBytes(32);
  const encoded = await hashPassword('Velvet-Strong-2026', pepper);
  assert.match(encoded, /^scrypt\$/);
  assert.equal(await verifyPassword('Velvet-Strong-2026', encoded, pepper), true);
  assert.equal(await verifyPassword('Wrong-Password-2026', encoded, pepper), false);
});

test('signs and verifies an EdDSA access token with audience isolation', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const token = createAccessToken({
    subject: '66f21bf8-3dd7-4df7-b8eb-3270760083f2',
    roles: [ROLES.MEMBER],
    audience: 'members',
    issuer: 'https://auth.velvet.test',
    ttlSeconds: 900,
    privateKey,
    now: 1_800_000_000_000
  });
  const payload = verifyAccessToken(token, {
    issuer: 'https://auth.velvet.test',
    audience: 'members',
    publicKey,
    now: 1_800_000_010_000
  });
  assert.equal(payload.sub, '66f21bf8-3dd7-4df7-b8eb-3270760083f2');
  assert.deepEqual(payload.roles, [ROLES.MEMBER]);
  assert.throws(() => verifyAccessToken(token, {
    issuer: 'https://auth.velvet.test',
    audience: 'control',
    publicKey,
    now: 1_800_000_010_000
  }), /invalid_claims/);
});

test('creates opaque refresh tokens and deterministic database hashes', () => {
  const token = createRefreshToken();
  assert.ok(token.length > 50);
  assert.equal(hashRefreshToken(token), hashRefreshToken(token));
  assert.notEqual(hashRefreshToken(token), token);
});

test('encrypts sensitive JSON with AES-256-GCM and authenticated context', () => {
  const key = randomBytes(32);
  const encryptor = createEncryptor({ keys: new Map([['v1', key]]), activeKeyId: 'v1' });
  const envelope = encryptor.encrypt({ exactLocation: 'private', phone: '+33000000000' }, 'member_profile:user-1');
  assert.deepEqual(
    encryptor.decrypt(envelope, 'member_profile:user-1'),
    { exactLocation: 'private', phone: '+33000000000' }
  );
  assert.throws(() => encryptor.decrypt(envelope, 'member_profile:user-2'));
});

test('enforces RBAC role checks', () => {
  const identity = { roles: [ROLES.MODERATOR] };
  assert.equal(hasAnyRole(identity, [ROLES.MODERATOR, ROLES.ADMIN]), true);
  assert.doesNotThrow(() => requireAnyRole(identity, [ROLES.MODERATOR]));
  assert.throws(() => requireAnyRole(identity, [ROLES.ADMIN]), /forbidden/);
});

test('parses cookies and applies rate limits', () => {
  assert.deepEqual(parseCookies('a=1; velvet_refresh=abc'), { a: '1', velvet_refresh: 'abc' });
  const limiter = createRateLimiter({ windowMs: 1000, max: 2 });
  assert.equal(limiter('ip', 100).allowed, true);
  assert.equal(limiter('ip', 200).allowed, true);
  assert.equal(limiter('ip', 300).allowed, false);
  assert.equal(limiter('ip', 1200).allowed, true);
});
