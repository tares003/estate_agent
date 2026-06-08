import { describe, expect, it } from 'vitest';
import { viewingRequestSchema } from './viewing-request.js';

/** A deterministic, fully-valid viewing-request submission. */
function validFixture() {
  return {
    name: 'Beatrice Badger',
    email: 'badger@example.invalid',
    phone: '07911123456',
    propertyId: 'prop_badger_002',
    preferredDate: '2026-07-01',
    alternativeDate: '2026-07-02',
    message: 'Afternoons suit me best.',
    gdpr_consent: true as const,
  };
}

/** Return a shallow copy of the fixture with one key removed. */
function omit(key: keyof ReturnType<typeof validFixture>) {
  const copy: Record<string, unknown> = { ...validFixture() };
  delete copy[key];
  return copy;
}

describe('viewingRequestSchema', () => {
  it('parses a valid fixture', () => {
    expect(viewingRequestSchema.safeParse(validFixture()).success).toBe(true);
  });

  it('parses when the optional alternativeDate is omitted', () => {
    expect(viewingRequestSchema.safeParse(omit('alternativeDate')).success).toBe(true);
  });

  it('parses when the optional message is omitted', () => {
    expect(viewingRequestSchema.safeParse(omit('message')).success).toBe(true);
  });

  it('rejects an invalid email', () => {
    expect(
      viewingRequestSchema.safeParse({ ...validFixture(), email: 'not-an-email' }).success,
    ).toBe(false);
  });

  it('rejects a false gdpr_consent', () => {
    expect(viewingRequestSchema.safeParse({ ...validFixture(), gdpr_consent: false }).success).toBe(
      false,
    );
  });

  it('rejects a missing gdpr_consent', () => {
    expect(viewingRequestSchema.safeParse(omit('gdpr_consent')).success).toBe(false);
  });

  it('rejects a missing name', () => {
    expect(viewingRequestSchema.safeParse(omit('name')).success).toBe(false);
  });

  it('rejects a missing email', () => {
    expect(viewingRequestSchema.safeParse(omit('email')).success).toBe(false);
  });

  it('rejects a missing phone', () => {
    expect(viewingRequestSchema.safeParse(omit('phone')).success).toBe(false);
  });

  it('rejects a missing propertyId', () => {
    expect(viewingRequestSchema.safeParse(omit('propertyId')).success).toBe(false);
  });

  it('rejects a missing preferredDate', () => {
    expect(viewingRequestSchema.safeParse(omit('preferredDate')).success).toBe(false);
  });
});
