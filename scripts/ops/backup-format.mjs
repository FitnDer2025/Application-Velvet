import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const MAGIC = Buffer.from('VELVETBAK1\n', 'utf8');

export function backupKey(value) {
  const text = String(value || '').trim();
  const decoded = /^[0-9a-f]{64}$/i.test(text)
    ? Buffer.from(text, 'hex')
    : Buffer.from(text, 'base64');
  if (decoded.length !== 32) throw new Error('VELVET_BACKUP_KEY doit contenir exactement 32 octets (hex ou base64).');
  return decoded;
}

export function connectionFingerprint(value) {
  const parsed = new URL(String(value));
  const identity = `${parsed.protocol}//${parsed.hostname}:${parsed.port || '5432'}${parsed.pathname}`.toLowerCase();
  return createHash('sha256').update(identity).digest('hex');
}

export function encryptBackup(plain, key, metadata = {}) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const header = {
    format: 'velvet-backup-v1',
    cipher: 'aes-256-gcm',
    created_at: new Date().toISOString(),
    nonce: nonce.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    sha256: createHash('sha256').update(plain).digest('hex'),
    ...metadata
  };
  return Buffer.concat([MAGIC, Buffer.from(`${JSON.stringify(header)}\n`, 'utf8'), encrypted]);
}

export function decryptBackup(payload, key) {
  if (!payload.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Format de sauvegarde Velvet invalide.');
  const headerEnd = payload.indexOf(10, MAGIC.length);
  if (headerEnd < 0) throw new Error('En-tête de sauvegarde Velvet invalide.');
  const header = JSON.parse(payload.subarray(MAGIC.length, headerEnd).toString('utf8'));
  if (header.format !== 'velvet-backup-v1' || header.cipher !== 'aes-256-gcm') {
    throw new Error('Version de sauvegarde Velvet non prise en charge.');
  }
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(header.nonce, 'base64'));
  decipher.setAuthTag(Buffer.from(header.tag, 'base64'));
  const plain = Buffer.concat([decipher.update(payload.subarray(headerEnd + 1)), decipher.final()]);
  const checksum = createHash('sha256').update(plain).digest('hex');
  if (checksum !== header.sha256) throw new Error('Contrôle d’intégrité de la sauvegarde échoué.');
  return { header, plain };
}
