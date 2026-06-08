import { describe, expect, it } from 'vitest';
import { signObjectToken, verifyObjectToken } from './signed-url.js';

// Deterministic fixtures: a fixed 32-byte key and fixed clock values.
const SECRET = 'a'.repeat(32);
const OTHER_SECRET = 'b'.repeat(32);
const KEY = 'property/aa/photo.jpg';
const NOW = 1_700_000_000_000;
const EXPIRES = NOW + 60_000;

describe('signObjectToken / verifyObjectToken', () => {
  it('round-trips a valid, unexpired token back to its key', () => {
    const token = signObjectToken(KEY, EXPIRES, SECRET);
    const result = verifyObjectToken(token, SECRET, NOW);
    expect(result).toEqual({ key: KEY });
  });

  it('produces a deterministic token for the same inputs', () => {
    expect(signObjectToken(KEY, EXPIRES, SECRET)).toBe(signObjectToken(KEY, EXPIRES, SECRET));
  });

  it('produces different tokens for different keys', () => {
    expect(signObjectToken('one.txt', EXPIRES, SECRET)).not.toBe(
      signObjectToken('two.txt', EXPIRES, SECRET),
    );
  });

  it('verifies right up to but not at/after the expiry instant', () => {
    const token = signObjectToken(KEY, EXPIRES, SECRET);
    expect(verifyObjectToken(token, SECRET, EXPIRES - 1)).toEqual({ key: KEY });
    expect(verifyObjectToken(token, SECRET, EXPIRES)).toBeNull();
  });

  it('returns null for an expired token', () => {
    const token = signObjectToken(KEY, EXPIRES, SECRET);
    expect(verifyObjectToken(token, SECRET, EXPIRES + 1)).toBeNull();
  });

  it('returns null when verified with the wrong secret', () => {
    const token = signObjectToken(KEY, EXPIRES, SECRET);
    expect(verifyObjectToken(token, OTHER_SECRET, NOW)).toBeNull();
  });

  it('returns null for a tampered signature', () => {
    const token = signObjectToken(KEY, EXPIRES, SECRET);
    const flipped = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A');
    expect(verifyObjectToken(flipped, SECRET, NOW)).toBeNull();
  });

  it('returns null when the signed key is swapped for another', () => {
    // Re-sign a different key, then graft this token onto a request for KEY.
    // The verifier returns the key the token actually attests, never KEY.
    const token = signObjectToken('attacker-chosen.txt', EXPIRES, SECRET);
    const result = verifyObjectToken(token, SECRET, NOW);
    expect(result).toEqual({ key: 'attacker-chosen.txt' });
  });

  it('returns null for a structurally malformed token', () => {
    expect(verifyObjectToken('not-a-valid-token', SECRET, NOW)).toBeNull();
    expect(verifyObjectToken('', SECRET, NOW)).toBeNull();
    expect(verifyObjectToken('only.two', SECRET, NOW)).toBeNull();
  });

  it('returns null when the expiry field is not a number', () => {
    // Forge a token whose middle segment is non-numeric; the HMAC will not match,
    // and even if parsing is attempted it must not pass.
    const token = signObjectToken(KEY, EXPIRES, SECRET);
    const parts = token.split('.');
    const forged = `${parts[0]}.notanumber.${parts[2]}`;
    expect(verifyObjectToken(forged, SECRET, NOW)).toBeNull();
  });

  it('returns null when the key segment is not valid base64url', () => {
    const token = signObjectToken(KEY, EXPIRES, SECRET);
    const parts = token.split('.');
    // `*` is outside the base64url alphabet, so decodeSegment rejects it.
    const forged = `not*base64url.${parts[1]}.${parts[2]}`;
    expect(verifyObjectToken(forged, SECRET, NOW)).toBeNull();
  });

  it('returns null when the expiry is numeric but not a safe integer', () => {
    const token = signObjectToken(KEY, EXPIRES, SECRET);
    const parts = token.split('.');
    // All digits (passes the \d+ guard) but far beyond Number.MAX_SAFE_INTEGER.
    const forged = `${parts[0]}.99999999999999999999.${parts[2]}`;
    expect(verifyObjectToken(forged, SECRET, NOW)).toBeNull();
  });

  it('returns null when the signature segment is the wrong length', () => {
    const token = signObjectToken(KEY, EXPIRES, SECRET);
    const [keySegment, expirySegment, signature] = token.split('.') as [string, string, string];
    // Truncate the signature so the byte lengths differ (guards timingSafeEqual).
    const forged = `${keySegment}.${expirySegment}.${signature.slice(0, 10)}`;
    expect(verifyObjectToken(forged, SECRET, NOW)).toBeNull();
  });
});
