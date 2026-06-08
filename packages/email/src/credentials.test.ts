import { describe, expect, it } from 'vitest';

import { decryptCredentials, encryptCredentials, type SmtpCredentials } from './credentials.js';

/** Deterministic 32-byte key (no env, no randomness in the fixture). */
const KEY = Buffer.alloc(32, 7);

const CREDS: SmtpCredentials = {
  host: 'smtp.office365.com',
  port: 587,
  secure: false,
  user: 'agent@example.co.uk',
  pass: 'app-password-1234',
  fromAddress: 'lettings@example.co.uk',
  replyTo: 'no-reply@example.co.uk',
};

describe('encryptCredentials / decryptCredentials', () => {
  it('round-trips the credentials unchanged (positive)', () => {
    const ciphertext = encryptCredentials(CREDS, KEY);
    expect(decryptCredentials(ciphertext, KEY)).toEqual(CREDS);
  });

  it('round-trips credentials without the optional replyTo (edge)', () => {
    const withoutReplyTo: SmtpCredentials = {
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      user: 'agent@example.com',
      pass: 'secret',
      fromAddress: 'sales@example.com',
    };
    const ciphertext = encryptCredentials(withoutReplyTo, KEY);
    const decrypted = decryptCredentials(ciphertext, KEY);
    expect(decrypted).toEqual(withoutReplyTo);
    expect(decrypted.replyTo).toBeUndefined();
  });

  it('never emits the plaintext password in the ciphertext (security)', () => {
    const ciphertext = encryptCredentials(CREDS, KEY);
    expect(ciphertext).not.toContain(CREDS.pass);
    expect(ciphertext).not.toContain(CREDS.user);
  });

  it('produces a fresh IV per call so equal inputs differ (security)', () => {
    expect(encryptCredentials(CREDS, KEY)).not.toEqual(encryptCredentials(CREDS, KEY));
  });

  it('throws when the encryption key is not 32 bytes (negative)', () => {
    const shortKey = Buffer.alloc(31, 7);
    expect(() => encryptCredentials(CREDS, shortKey)).toThrow(/32 bytes/);
  });

  it('throws when the decryption key is not 32 bytes (negative)', () => {
    const ciphertext = encryptCredentials(CREDS, KEY);
    const shortKey = Buffer.alloc(31, 7);
    expect(() => decryptCredentials(ciphertext, shortKey)).toThrow(/32 bytes/);
  });

  it('throws when the ciphertext was tampered with (auth-tag verification)', () => {
    const ciphertext = encryptCredentials(CREDS, KEY);
    const parts = ciphertext.split('.');
    // Flip a byte in the encrypted payload (last segment).
    const payload = Buffer.from(parts[2] ?? '', 'base64');
    payload[0] = payload[0]! ^ 0xff;
    const tampered = `${parts[0]}.${parts[1]}.${payload.toString('base64')}`;
    expect(() => decryptCredentials(tampered, KEY)).toThrow();
  });

  it('throws when decrypting with the wrong key (auth-tag verification)', () => {
    const ciphertext = encryptCredentials(CREDS, KEY);
    const wrongKey = Buffer.alloc(32, 9);
    expect(() => decryptCredentials(ciphertext, wrongKey)).toThrow();
  });

  it('throws when the ciphertext envelope is malformed (negative)', () => {
    expect(() => decryptCredentials('not-a-valid-envelope', KEY)).toThrow();
  });
});
