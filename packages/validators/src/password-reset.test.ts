import { describe, expect, it } from 'vitest';

import { passwordResetRequestSchema, passwordResetSchema } from './password-reset.js';

// EPIC-N FR-N-5 — the password-reset forms.
//
// `passwordResetRequestSchema` backs `/forgot-password`: a visitor enters the
// email of an existing account to be sent a reset link. It captures personal data
// (the email), so it carries the mandatory `gdpr_consent` affirmation (G5; master
// spec §S.7) re-confirming the lawful basis for processing the address to send the
// link.
//
// `passwordResetSchema` backs `/reset-password`: the visitor sets a NEW password,
// carrying the opaque single-use token from the email. It captures NO personal
// data (only a secret + an opaque token), so no consent affirmation applies. The
// password meets the same minimum-length floor as registration (FR-N-1 hashes it).

describe('passwordResetRequestSchema', () => {
  const GOOD = { email: 'penny@example.invalid', gdpr_consent: true };

  it('accepts a well-formed reset request', () => {
    expect(passwordResetRequestSchema.safeParse(GOOD).success).toBe(true);
  });

  it('lowercases and trims the email', () => {
    const parsed = passwordResetRequestSchema.safeParse({
      ...GOOD,
      email: '  Penny@Example.Invalid ',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.email).toBe('penny@example.invalid');
  });

  it('rejects a malformed email', () => {
    expect(passwordResetRequestSchema.safeParse({ ...GOOD, email: 'nope' }).success).toBe(false);
  });

  it('rejects a request with GDPR consent unticked (G5 — fail-closed)', () => {
    expect(passwordResetRequestSchema.safeParse({ ...GOOD, gdpr_consent: false }).success).toBe(
      false,
    );
  });

  it('rejects a request with GDPR consent missing entirely', () => {
    expect(passwordResetRequestSchema.safeParse({ email: GOOD.email }).success).toBe(false);
  });
});

describe('passwordResetSchema', () => {
  const GOOD = { token: 'aZ09aZ09aZ09aZ09aZ09aZ09', password: 'correct horse battery' };

  it('accepts a well-formed reset (token + new password)', () => {
    expect(passwordResetSchema.safeParse(GOOD).success).toBe(true);
  });

  it('rejects a password below the minimum length', () => {
    expect(passwordResetSchema.safeParse({ ...GOOD, password: 'short' }).success).toBe(false);
  });

  it('rejects a missing or empty token', () => {
    expect(passwordResetSchema.safeParse({ ...GOOD, token: '' }).success).toBe(false);
    expect(passwordResetSchema.safeParse({ password: GOOD.password }).success).toBe(false);
  });

  it('does not require — and has no — a personal-data field (no consent applies)', () => {
    const parsed = passwordResetSchema.safeParse(GOOD);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(Object.keys(parsed.data).sort()).toEqual(['password', 'token']);
    }
  });
});
