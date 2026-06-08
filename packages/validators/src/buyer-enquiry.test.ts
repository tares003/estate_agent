import { describe, expect, it } from 'vitest';
import { buyerEnquirySchema } from './buyer-enquiry.js';

/** A deterministic, fully-valid buyer-enquiry submission. */
function validFixture() {
  return {
    name: 'Albert Aardvark',
    email: 'aardvark@example.invalid',
    phone: '07911123456',
    message: 'I would like more information about this property.',
    propertyId: 'prop_aardvark_001',
    gdpr_consent: true as const,
  };
}

/** Return a shallow copy of the fixture with one key removed. */
function omit(key: keyof ReturnType<typeof validFixture>) {
  const copy: Record<string, unknown> = { ...validFixture() };
  delete copy[key];
  return copy;
}

describe('buyerEnquirySchema', () => {
  it('parses a valid fixture', () => {
    expect(buyerEnquirySchema.safeParse(validFixture()).success).toBe(true);
  });

  it('parses when the optional phone is omitted', () => {
    expect(buyerEnquirySchema.safeParse(omit('phone')).success).toBe(true);
  });

  it('parses when the optional propertyId is omitted', () => {
    expect(buyerEnquirySchema.safeParse(omit('propertyId')).success).toBe(true);
  });

  it('rejects an invalid email', () => {
    expect(buyerEnquirySchema.safeParse({ ...validFixture(), email: 'not-an-email' }).success).toBe(
      false,
    );
  });

  it('rejects a false gdpr_consent', () => {
    expect(buyerEnquirySchema.safeParse({ ...validFixture(), gdpr_consent: false }).success).toBe(
      false,
    );
  });

  it('rejects a missing gdpr_consent', () => {
    expect(buyerEnquirySchema.safeParse(omit('gdpr_consent')).success).toBe(false);
  });

  it('rejects a missing name', () => {
    expect(buyerEnquirySchema.safeParse(omit('name')).success).toBe(false);
  });

  it('rejects a missing email', () => {
    expect(buyerEnquirySchema.safeParse(omit('email')).success).toBe(false);
  });

  it('rejects a missing message', () => {
    expect(buyerEnquirySchema.safeParse(omit('message')).success).toBe(false);
  });
});
