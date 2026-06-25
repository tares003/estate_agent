import { describe, expect, it } from 'vitest';

import { customerRegistrationSchema } from './customer-registration.js';

// EPIC-T FR-T-1 — the customer-registration form input. Captures personal data
// (name + email), so it carries the `gdpr_consent` affirmation (G5). The password
// must meet a minimum strength floor (FR-N-1 hashes it; this validates the input
// shape). Marketing opt-in is OPTIONAL and defaults to false (separate from the
// mandatory GDPR consent — opting out of marketing must not block registration).

const GOOD = {
  name: 'Penny Pomeroy',
  email: 'penny@example.invalid',
  password: 'correct horse battery',
  gdpr_consent: true,
  marketingOptIn: false,
};

describe('customerRegistrationSchema', () => {
  it('accepts a well-formed registration', () => {
    const parsed = customerRegistrationSchema.safeParse(GOOD);
    expect(parsed.success).toBe(true);
  });

  it('lowercases and trims the email', () => {
    const parsed = customerRegistrationSchema.safeParse({
      ...GOOD,
      email: '  Penny@Example.Invalid ',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.email).toBe('penny@example.invalid');
  });

  it('rejects a missing name', () => {
    const parsed = customerRegistrationSchema.safeParse({ ...GOOD, name: '   ' });
    expect(parsed.success).toBe(false);
  });

  it('rejects a malformed email', () => {
    const parsed = customerRegistrationSchema.safeParse({ ...GOOD, email: 'not-an-email' });
    expect(parsed.success).toBe(false);
  });

  it('rejects a password below the minimum length', () => {
    const parsed = customerRegistrationSchema.safeParse({ ...GOOD, password: 'short' });
    expect(parsed.success).toBe(false);
  });

  it('rejects a registration with GDPR consent unticked (G5 — fail-closed)', () => {
    const parsed = customerRegistrationSchema.safeParse({ ...GOOD, gdpr_consent: false });
    expect(parsed.success).toBe(false);
  });

  it('rejects a registration with GDPR consent missing entirely', () => {
    const { gdpr_consent: _omit, ...withoutConsent } = GOOD;
    const parsed = customerRegistrationSchema.safeParse(withoutConsent);
    expect(parsed.success).toBe(false);
  });

  it('defaults marketingOptIn to false when omitted (registration must not require it)', () => {
    const { marketingOptIn: _omit, ...withoutMarketing } = GOOD;
    const parsed = customerRegistrationSchema.safeParse(withoutMarketing);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.marketingOptIn).toBe(false);
  });

  it('accepts an explicit marketing opt-in', () => {
    const parsed = customerRegistrationSchema.safeParse({ ...GOOD, marketingOptIn: true });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.marketingOptIn).toBe(true);
  });
});
