import { createHash, randomBytes, randomUUID, sign, verify } from 'node:crypto';

const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const decode = (value) => JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));

export function createAccessToken({ subject, roles, audience, issuer, ttlSeconds, privateKey, now = Date.now() }) {
  const iat = Math.floor(now / 1000);
  const header = { alg: 'EdDSA', typ: 'JWT', kid: 'velvet-auth-v1' };
  const payload = {
    iss: issuer,
    aud: audience,
    sub: subject,
    roles: [...new Set(roles)].sort(),
    iat,
    nbf: iat - 5,
    exp: iat + ttlSeconds,
    jti: randomUUID()
  };
  const unsigned = `${encode(header)}.${encode(payload)}`;
  const signature = sign(null, Buffer.from(unsigned), privateKey).toString('base64url');
  return `${unsigned}.${signature}`;
}

export function verifyAccessToken(token, { issuer, audience, publicKey, now = Date.now() }) {
  const parts = String(token).split('.');
  if (parts.length !== 3) throw new Error('invalid_token');
  const [headerPart, payloadPart, signaturePart] = parts;
  const header = decode(headerPart);
  if (header.alg !== 'EdDSA') throw new Error('invalid_algorithm');
  const valid = verify(
    null,
    Buffer.from(`${headerPart}.${payloadPart}`),
    publicKey,
    Buffer.from(signaturePart, 'base64url')
  );
  if (!valid) throw new Error('invalid_signature');
  const payload = decode(payloadPart);
  const seconds = Math.floor(now / 1000);
  if (payload.iss !== issuer || payload.aud !== audience || seconds < payload.nbf || seconds >= payload.exp) {
    throw new Error('invalid_claims');
  }
  return payload;
}

export function createRefreshToken() {
  return randomBytes(48).toString('base64url');
}

export function hashRefreshToken(token) {
  return createHash('sha256').update(token).digest('hex');
}
