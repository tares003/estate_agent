import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// Field-level secret encryption (AES-256-GCM) for at-rest storage of individual
// secret strings (e.g. a tenant's SMTP password). The envelope is three
// dot-separated base64 segments: `iv.authTag.ciphertext`. A fresh random IV per
// call means encrypting the same value twice yields different ciphertext.

const KEY_BYTES = 32;
const IV_BYTES = 12;
const ALGORITHM = 'aes-256-gcm';
const ENVELOPE_PARTS = 3;

function assertKey(key: Buffer): void {
  if (key.length !== KEY_BYTES) {
    throw new Error(`encryption key must be ${KEY_BYTES} bytes, got ${key.length}`);
  }
}

/** Encrypt a string with AES-256-GCM, returning a base64 `iv.authTag.ciphertext` envelope. */
export function encryptSecret(plaintext: string, key: Buffer): string {
  assertKey(key);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(
    '.',
  );
}

/** Decrypt an envelope produced by {@link encryptSecret}. Throws on a wrong key, a
 * malformed envelope, or tampering (GCM auth-tag verification). */
export function decryptSecret(envelope: string, key: Buffer): string {
  assertKey(key);
  const parts = envelope.split('.');
  if (parts.length !== ENVELOPE_PARTS) {
    throw new Error('malformed credential envelope');
  }
  const [ivPart, authTagPart, payloadPart] = parts as [string, string, string];
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivPart, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagPart, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payloadPart, 'base64')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

/** Whether a value looks like an {@link encryptSecret} envelope (3 base64 parts) —
 * used to avoid re-encrypting an already-encrypted stored value. */
export function isSecretEnvelope(value: string): boolean {
  const parts = value.split('.');
  if (parts.length !== ENVELOPE_PARTS) {
    return false;
  }
  return parts.every((part) => part.length > 0 && /^[A-Za-z0-9+/]+=*$/.test(part));
}
