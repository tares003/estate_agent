import { describe, expect, it } from 'vitest';

import { customerSignInSchema } from './customer-sign-in.js';

// EPIC-T FR-T-3 — the customer sign-in form input (`/sign-in`). A registered
// customer authenticates with email + password. Unlike registration this form
// CAPTURES no new personal data (it transmits an existing credential), so it
// carries no `gdpr_consent` affirmation — the G5 false-positive on the email
// credential is suppressed in the schema module with a justified disable. The
// password is validated only as a non-empty string here: the minimum-length
// FLOOR belongs at registration, and re-asserting it at sign-in would both leak
// the policy and lock out an account whose stored password predates the rule.

const GOOD = {
  email: 'penny@example.invalid',
  password: 'correct horse battery',
};

describe('customerSignInSchema', () => {
  it('accepts a well-formed sign-in', () => {
    const parsed = customerSignInSchema.safeParse(GOOD);
    expect(parsed.success).toBe(true);
  });

  it('lowercases and trims the email (matches the registration normalisation)', () => {
    const parsed = customerSignInSchema.safeParse({ ...GOOD, email: '  Penny@Example.Invalid ' });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.email).toBe('penny@example.invalid');
  });

  it('rejects a malformed email', () => {
    const parsed = customerSignInSchema.safeParse({ ...GOOD, email: 'not-an-email' });
    expect(parsed.success).toBe(false);
  });

  it('rejects a missing email', () => {
    const { email: _omit, ...withoutEmail } = GOOD;
    const parsed = customerSignInSchema.safeParse(withoutEmail);
    expect(parsed.success).toBe(false);
  });

  it('rejects an empty password', () => {
    const parsed = customerSignInSchema.safeParse({ ...GOOD, password: '' });
    expect(parsed.success).toBe(false);
  });

  it('does NOT enforce the registration minimum-length floor on the password', () => {
    // A short password must still parse at sign-in — the floor is a registration
    // rule; the credential either matches the stored hash or it does not.
    const parsed = customerSignInSchema.safeParse({ ...GOOD, password: 'short' });
    expect(parsed.success).toBe(true);
  });

  it('rejects a missing password', () => {
    const { password: _omit, ...withoutPassword } = GOOD;
    const parsed = customerSignInSchema.safeParse(withoutPassword);
    expect(parsed.success).toBe(false);
  });
});
