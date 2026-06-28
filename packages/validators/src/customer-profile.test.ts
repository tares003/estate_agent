import { describe, expect, it } from 'vitest';

import { customerProfileUpdateSchema } from './customer-profile.js';

// EPIC-T FR-T-11 — a signed-in customer edits their own profile: display name,
// an OPTIONAL phone, the email/SMS contact preferences and the marketing opt-in.
// No fresh GDPR consent (self-service edit of an already-consented account — the
// marketing toggle is the consent control); the phone is optional and an empty
// box clears it; a non-empty phone must be a valid UK number.

describe('customerProfileUpdateSchema (FR-T-11)', () => {
  it('accepts a full profile with name, phone, preferences and marketing opt-in', () => {
    const parsed = customerProfileUpdateSchema.parse({
      name: '  Albert Aardvark  ',
      phone: '07911 123456',
      contactByEmail: true,
      contactBySms: true,
      marketingOptIn: true,
    });
    expect(parsed.name).toBe('Albert Aardvark'); // trimmed
    expect(parsed.phone).toBe('07911 123456');
    expect(parsed.contactByEmail).toBe(true);
    expect(parsed.contactBySms).toBe(true);
    expect(parsed.marketingOptIn).toBe(true);
  });

  it('treats an empty phone as cleared (undefined), not an error', () => {
    const parsed = customerProfileUpdateSchema.parse({ name: 'Beatrix', phone: '' });
    expect(parsed.phone).toBeUndefined();
  });

  it('treats a whitespace-only phone as cleared', () => {
    const parsed = customerProfileUpdateSchema.parse({ name: 'Beatrix', phone: '   ' });
    expect(parsed.phone).toBeUndefined();
  });

  it('accepts an international +44 phone', () => {
    const parsed = customerProfileUpdateSchema.parse({ name: 'Cleo', phone: '+44 7911 123456' });
    expect(parsed.phone).toBe('+44 7911 123456');
  });

  it('rejects a non-empty but invalid phone', () => {
    expect(
      customerProfileUpdateSchema.safeParse({ name: 'Dora', phone: 'not-a-phone' }).success,
    ).toBe(false);
  });

  it('rejects a blank / whitespace-only name', () => {
    expect(customerProfileUpdateSchema.safeParse({ name: '   ' }).success).toBe(false);
  });

  it('defaults the preference + marketing flags to false when omitted (unchecked box)', () => {
    const parsed = customerProfileUpdateSchema.parse({ name: 'Edith' });
    expect(parsed.contactByEmail).toBe(false);
    expect(parsed.contactBySms).toBe(false);
    expect(parsed.marketingOptIn).toBe(false);
  });

  it('captures no GDPR-consent field (self-service edit of an existing account)', () => {
    const parsed = customerProfileUpdateSchema.parse({ name: 'Fred' });
    expect('gdpr_consent' in parsed).toBe(false);
  });
});
