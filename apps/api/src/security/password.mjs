import { promisify } from 'node:util';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';

const scrypt = promisify(scryptCallback);
const PARAMETERS = Object.freeze({ N: 32768, r: 8, p: 1, keyLength: 64 });

export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 200) {
    return { valid: false, reason: 'Le mot de passe doit contenir entre 12 et 200 caractères.' };
  }
  if (!/[a-z]/u.test(password) || !/[A-Z]/u.test(password) || !/[0-9]/u.test(password)) {
    return { valid: false, reason: 'Le mot de passe doit contenir une minuscule, une majuscule et un chiffre.' };
  }
  return { valid: true };
}

export function normalizeEmail(email) {
  return String(email || '').trim().normalize('NFKC').toLowerCase();
}

export async function hashPassword(password, pepper) {
  const validation = validatePassword(password);
  if (!validation.valid) throw new Error(validation.reason);
  const salt = randomBytes(24);
  const input = Buffer.concat([Buffer.from(password.normalize('NFKC'), 'utf8'), pepper]);
  const derived = await scrypt(input, salt, PARAMETERS.keyLength, {
    N: PARAMETERS.N,
    r: PARAMETERS.r,
    p: PARAMETERS.p,
    maxmem: 64 * 1024 * 1024
  });
  return `scrypt$${PARAMETERS.N}$${PARAMETERS.r}$${PARAMETERS.p}$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

export async function verifyPassword(password, encoded, pepper) {
  try {
    const [algorithm, n, r, p, saltValue, hashValue] = String(encoded).split('$');
    if (algorithm !== 'scrypt') return false;
    const salt = Buffer.from(saltValue, 'base64url');
    const expected = Buffer.from(hashValue, 'base64url');
    const input = Buffer.concat([Buffer.from(password.normalize('NFKC'), 'utf8'), pepper]);
    const actual = await scrypt(input, salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 64 * 1024 * 1024
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
