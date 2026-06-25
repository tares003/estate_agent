import { describe, expect, it } from 'vitest';

import { AUTH_TOKEN_BYTES, generateAuthToken } from './tokens.js';

// EPIC-N FR-N-5 — single-use auth tokens must be "opaque random of at least 32
// bytes, encoded for URL safety". These tests lock the security properties of the
// generator wired into better-auth's magic-link plugin (auth.ts): the byte floor,
// the URL-safe encoding, and that successive tokens are unpredictable/unique.

describe('AUTH_TOKEN_BYTES', () => {
  it('meets the FR-N-5 floor of at least 32 bytes', () => {
    expect(AUTH_TOKEN_BYTES).toBeGreaterThanOrEqual(32);
  });
});

describe('generateAuthToken (FR-N-5)', () => {
  it('decodes to exactly AUTH_TOKEN_BYTES bytes of entropy', () => {
    const decoded = Buffer.from(generateAuthToken(), 'base64url');
    expect(decoded.length).toBe(AUTH_TOKEN_BYTES);
  });

  it('carries at least 32 bytes (256 bits) of entropy', () => {
    const decoded = Buffer.from(generateAuthToken(), 'base64url');
    expect(decoded.length).toBeGreaterThanOrEqual(32);
  });

  it('is URL-safe: only the base64url alphabet, no padding or +/ characters', () => {
    const token = generateAuthToken();
    // base64url (RFC 4648 §5): A-Z a-z 0-9 - _ , and NO '=' padding, '+' or '/'.
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token).not.toContain('=');
    expect(token).not.toContain('+');
    expect(token).not.toContain('/');
  });

  it('is long enough to encode 32 bytes (>= 43 url-safe chars)', () => {
    // ceil(32 * 8 / 6) = 43 characters of base64url carry 256 bits.
    expect(generateAuthToken().length).toBeGreaterThanOrEqual(43);
  });

  it('is opaque (unpredictable) — 2000 tokens are all distinct', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i += 1) seen.add(generateAuthToken());
    expect(seen.size).toBe(2000);
  });
});
