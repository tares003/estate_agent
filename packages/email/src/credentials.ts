import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * A tenant's SMTP credentials. The platform NEVER stores these in plaintext
 * (CLAUDE.md §9) — they are encrypted with {@link encryptCredentials} before
 * persistence and only decrypted server-side, in memory, at send time.
 */
export interface SmtpCredentials {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromAddress: string;
  replyTo?: string;
}

/** AES-256-GCM: 32-byte key, 96-bit (12-byte) IV, 128-bit (16-byte) auth tag. */
const KEY_BYTES = 32;
const IV_BYTES = 12;
const ALGORITHM = 'aes-256-gcm';
/** Envelope is three dot-separated base64 segments: iv.authTag.ciphertext. */
const ENVELOPE_PARTS = 3;

function assertKey(key: Buffer): void {
  if (key.length !== KEY_BYTES) {
    throw new Error(`encryption key must be ${KEY_BYTES} bytes, got ${key.length}`);
  }
}

/**
 * Encrypt SMTP credentials with AES-256-GCM. Returns a base64 envelope
 * `iv.authTag.ciphertext`. A fresh random IV is used per call, so encrypting
 * the same credentials twice yields different ciphertext.
 *
 * @param creds the credentials to encrypt
 * @param key a 32-byte key (throws otherwise)
 */
export function encryptCredentials(creds: SmtpCredentials, key: Buffer): string {
  assertKey(key);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const plaintext = Buffer.from(JSON.stringify(creds), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(
    '.',
  );
}

/**
 * Decrypt an envelope produced by {@link encryptCredentials}. Throws if the key
 * is the wrong size, the envelope is malformed, the key is wrong, or the
 * ciphertext was tampered with (GCM auth-tag verification fails).
 *
 * @param ciphertext the `iv.authTag.ciphertext` base64 envelope
 * @param key the 32-byte key the envelope was encrypted with
 */
export function decryptCredentials(ciphertext: string, key: Buffer): SmtpCredentials {
  assertKey(key);
  const parts = ciphertext.split('.');
  if (parts.length !== ENVELOPE_PARTS) {
    throw new Error('malformed credential envelope');
  }
  const [ivPart, authTagPart, payloadPart] = parts as [string, string, string];
  const iv = Buffer.from(ivPart, 'base64');
  const authTag = Buffer.from(authTagPart, 'base64');
  const payload = Buffer.from(payloadPart, 'base64');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(payload), decipher.final()]);
  return JSON.parse(plaintext.toString('utf8')) as SmtpCredentials;
}
