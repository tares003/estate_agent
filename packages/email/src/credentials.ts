import { decryptSecret, encryptSecret } from './secret.js';

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

/**
 * Encrypt SMTP credentials with AES-256-GCM (delegates to the field-level
 * {@link encryptSecret} over the JSON-serialised object). Returns a base64
 * `iv.authTag.ciphertext` envelope; a fresh random IV per call means encrypting
 * the same credentials twice yields different ciphertext.
 *
 * @param creds the credentials to encrypt
 * @param key a 32-byte key (throws otherwise)
 */
export function encryptCredentials(creds: SmtpCredentials, key: Buffer): string {
  return encryptSecret(JSON.stringify(creds), key);
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
  return JSON.parse(decryptSecret(ciphertext, key)) as SmtpCredentials;
}
