import { describe, expect, it } from 'vitest';
import { valuationRequestSchema } from './valuation-request.js';

/** A deterministic, fully-valid valuation-request submission. */
function validFixture() {
  return {
    name: 'Cuthbert Capybara',
    email: 'capybara@example.invalid',
    phone: '07911123456',
    addressLine1: '1 Aardvark Avenue',
    postcode: 'SW1A 1AA',
    propertyType: 'detached',
    bedrooms: 4,
    gdpr_consent: true as const,
  };
}

/** Return a shallow copy of the fixture with one key removed. */
function omit(key: keyof ReturnType<typeof validFixture>) {
  const copy: Record<string, unknown> = { ...validFixture() };
  delete copy[key];
  return copy;
}

describe('valuationRequestSchema', () => {
  it('parses a valid fixture', () => {
    expect(valuationRequestSchema.safeParse(validFixture()).success).toBe(true);
  });

  it('parses when the optional bedrooms is omitted', () => {
    expect(valuationRequestSchema.safeParse(omit('bedrooms')).success).toBe(true);
  });

  it('rejects a non-integer bedrooms', () => {
    expect(valuationRequestSchema.safeParse({ ...validFixture(), bedrooms: 2.5 }).success).toBe(
      false,
    );
  });

  it('rejects a negative bedrooms', () => {
    expect(valuationRequestSchema.safeParse({ ...validFixture(), bedrooms: -1 }).success).toBe(
      false,
    );
  });

  it('rejects an invalid email', () => {
    expect(
      valuationRequestSchema.safeParse({ ...validFixture(), email: 'not-an-email' }).success,
    ).toBe(false);
  });

  it('rejects an invalid postcode', () => {
    expect(
      valuationRequestSchema.safeParse({ ...validFixture(), postcode: 'NOT A POSTCODE' }).success,
    ).toBe(false);
  });

  it('rejects a false gdpr_consent', () => {
    expect(
      valuationRequestSchema.safeParse({ ...validFixture(), gdpr_consent: false }).success,
    ).toBe(false);
  });

  it('rejects a missing gdpr_consent', () => {
    expect(valuationRequestSchema.safeParse(omit('gdpr_consent')).success).toBe(false);
  });

  it('rejects a missing name', () => {
    expect(valuationRequestSchema.safeParse(omit('name')).success).toBe(false);
  });

  it('rejects a missing email', () => {
    expect(valuationRequestSchema.safeParse(omit('email')).success).toBe(false);
  });

  it('rejects a missing phone', () => {
    expect(valuationRequestSchema.safeParse(omit('phone')).success).toBe(false);
  });

  it('rejects a missing addressLine1', () => {
    expect(valuationRequestSchema.safeParse(omit('addressLine1')).success).toBe(false);
  });

  it('rejects a missing postcode', () => {
    expect(valuationRequestSchema.safeParse(omit('postcode')).success).toBe(false);
  });

  it('rejects a missing propertyType', () => {
    expect(valuationRequestSchema.safeParse(omit('propertyType')).success).toBe(false);
  });
});
