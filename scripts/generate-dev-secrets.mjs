import { generateKeyPairSync, randomBytes } from 'node:crypto';

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const encode = (value) => Buffer.from(value).toString('base64');
const privatePem = privateKey.export({ format: 'pem', type: 'pkcs8' });
const publicPem = publicKey.export({ format: 'pem', type: 'spki' });
const encryptionKey = randomBytes(32).toString('base64');

const output = [
  '# Copy these values into a local .env file. Never commit that file.',
  `JWT_PRIVATE_KEY_BASE64=${encode(privatePem)}`,
  `JWT_PUBLIC_KEY_BASE64=${encode(publicPem)}`,
  `PASSWORD_PEPPER_BASE64=${randomBytes(32).toString('base64')}`,
  'ENCRYPTION_ACTIVE_KEY_ID=v1',
  `ENCRYPTION_KEYS_JSON={"v1":"${encryptionKey}"}`,
  `AUDIT_HMAC_KEY_BASE64=${randomBytes(32).toString('base64')}`
  ,`INTEGRATION_SIGNING_KEY_BASE64=${randomBytes(32).toString('base64')}`
].join('\n');

process.stdout.write(`${output}\n`);
