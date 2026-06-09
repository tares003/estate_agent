import { describe, expect, it } from 'vitest';

import { decryptSecret, encryptSecret, isSecretEnvelope } from './secret.js';

// Field-level secret encryption (AES-256-GCM), for at-rest storage of individual
// secret fields (e.g. a tenant's SMTP password). Same envelope shape as the
// whole-credentials crypto: base64 `iv.authTag.ciphertext`.

const key = Buffer.alloc(32, 7);
const otherKey = Buffer.alloc(32, 9);

describe('encryptSecret / decryptSecret', () => {
  it('round-trips a string value', () => {
    const env = encryptSecret('hunter2', key);
    expect(decryptSecret(env, key)).toBe('hunter2');
  });

  it('round-trips an empty string', () => {
    expect(decryptSecret(encryptSecret('', key), key)).toBe('');
  });

  it('uses a fresh IV per call (same input -> different ciphertext)', () => {
    expect(encryptSecret('x', key)).not.toBe(encryptSecret('x', key));
  });

  it('throws when decrypting with the wrong key (GCM auth-tag check)', () => {
    const env = encryptSecret('secret', key);
    expect(() => decryptSecret(env, otherKey)).toThrow();
  });

  it('throws on a malformed envelope', () => {
    expect(() => decryptSecret('not-an-envelope', key)).toThrow(/malformed/i);
  });

  it('throws on a wrong-size key', () => {
    expect(() => encryptSecret('x', Buffer.alloc(16))).toThrow(/32 bytes/);
  });
});

describe('isSecretEnvelope', () => {
  it('recognises an envelope produced by encryptSecret', () => {
    expect(isSecretEnvelope(encryptSecret('x', key))).toBe(true);
  });

  it('rejects plaintext and obviously-non-envelope values', () => {
    expect(isSecretEnvelope('plaintext-password')).toBe(false);
    expect(isSecretEnvelope('a.b')).toBe(false);
    expect(isSecretEnvelope('')).toBe(false);
  });
});
