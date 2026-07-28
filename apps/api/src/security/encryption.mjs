import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export function createEncryptor({ keys, activeKeyId }) {
  function keyFor(id) {
    const key = keys.get(id);
    if (!key || key.length !== 32) throw new Error(`Encryption key ${id} is unavailable or invalid`);
    return key;
  }

  return Object.freeze({
    encrypt(value, associatedData) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', keyFor(activeKeyId), iv);
      cipher.setAAD(Buffer.from(associatedData, 'utf8'));
      const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
      return JSON.stringify({
        v: 1,
        kid: activeKeyId,
        iv: iv.toString('base64url'),
        tag: cipher.getAuthTag().toString('base64url'),
        data: ciphertext.toString('base64url')
      });
    },
    decrypt(envelope, associatedData) {
      const parsed = typeof envelope === 'string' ? JSON.parse(envelope) : envelope;
      const decipher = createDecipheriv(
        'aes-256-gcm',
        keyFor(parsed.kid),
        Buffer.from(parsed.iv, 'base64url')
      );
      decipher.setAAD(Buffer.from(associatedData, 'utf8'));
      decipher.setAuthTag(Buffer.from(parsed.tag, 'base64url'));
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(parsed.data, 'base64url')),
        decipher.final()
      ]);
      return JSON.parse(plaintext.toString('utf8'));
    }
  });
}
