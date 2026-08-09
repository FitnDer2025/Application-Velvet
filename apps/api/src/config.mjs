const required = [
  'DATABASE_URL',
  'JWT_PRIVATE_KEY_BASE64',
  'JWT_PUBLIC_KEY_BASE64',
  'PASSWORD_PEPPER_BASE64',
  'ENCRYPTION_KEYS_JSON',
  'ENCRYPTION_ACTIVE_KEY_ID',
  'AUDIT_HMAC_KEY_BASE64'
];

function base64Buffer(value, name, min = 32) {
  const buffer = Buffer.from(value, 'base64');
  if (buffer.length < min) throw new Error(`${name} must decode to at least ${min} bytes`);
  return buffer;
}

export function loadConfig(env = process.env) {
  const missing = required.filter((name) => !env[name]);
  if (missing.length) throw new Error(`Missing environment variables: ${missing.join(', ')}`);

  const encryptionEntries = JSON.parse(env.ENCRYPTION_KEYS_JSON);
  const encryptionKeys = new Map(
    Object.entries(encryptionEntries).map(([id, value]) => [id, base64Buffer(value, `ENCRYPTION_KEYS_JSON.${id}`, 32)])
  );
  const activeEncryptionKeyId = env.ENCRYPTION_ACTIVE_KEY_ID;
  if (!encryptionKeys.has(activeEncryptionKeyId)) throw new Error('Active encryption key is not in ENCRYPTION_KEYS_JSON');

  return Object.freeze({
    nodeEnv: env.NODE_ENV || 'development',
    port: Number(env.PORT || 8080),
    databaseUrl: env.DATABASE_URL,
    databaseSsl: env.DATABASE_SSL === 'true',
    corsOrigins: new Set((env.CORS_ORIGINS || '').split(',').map((x) => x.trim()).filter(Boolean)),
    cookieDomain: env.COOKIE_DOMAIN || '',
    cookieSecure: env.COOKIE_SECURE !== 'false' && (env.NODE_ENV || 'development') !== 'development',
    jwtIssuer: env.JWT_ISSUER || 'https://auth.velvet.local',
    accessTtlSeconds: Number(env.JWT_ACCESS_TTL_SECONDS || 900),
    jwtPrivateKey: Buffer.from(env.JWT_PRIVATE_KEY_BASE64, 'base64').toString('utf8'),
    jwtPublicKey: Buffer.from(env.JWT_PUBLIC_KEY_BASE64, 'base64').toString('utf8'),
    passwordPepper: base64Buffer(env.PASSWORD_PEPPER_BASE64, 'PASSWORD_PEPPER_BASE64'),
    encryptionKeys,
    activeEncryptionKeyId,
    auditHmacKey: base64Buffer(env.AUDIT_HMAC_KEY_BASE64, 'AUDIT_HMAC_KEY_BASE64'),
    autoMigrate: env.AUTO_MIGRATE === 'true'
  });
}
