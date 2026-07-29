import assert from 'node:assert/strict';
import test from 'node:test';
import { validateBetaPassword, verifyTurnstile } from '../../../functions/api/auth/_shared.js';

test('enforces the BETA password policy', () => {
  assert.equal(validateBetaPassword('trop-court').valid, false);
  assert.equal(validateBetaPassword('motdepasse-seulement').valid, false);
  assert.equal(validateBetaPassword('Velvet-Solide-2026!').valid, true);
});

test('keeps Turnstile optional until its server secret is configured', async () => {
  const result = await verifyTurnstile(
    new Request('https://velvet.test/'),
    {},
    null,
    'login'
  );
  assert.deepEqual(result, { ok: true, configured: false });
});
