import { describe, expect, it } from 'vitest';
import * as validators from './index.js';

describe('@estate/validators public surface', () => {
  it('re-exports every public-form schema', () => {
    expect(typeof validators.buyerEnquirySchema.safeParse).toBe('function');
    expect(typeof validators.viewingRequestSchema.safeParse).toBe('function');
    expect(typeof validators.valuationRequestSchema.safeParse).toBe('function');
    expect(typeof validators.repairRequestSchema.safeParse).toBe('function');
  });

  it('re-exports the shared field helpers', () => {
    expect(typeof validators.email.safeParse).toBe('function');
    expect(typeof validators.ukPhone.safeParse).toBe('function');
    expect(typeof validators.ukPostcode.safeParse).toBe('function');
    expect(typeof validators.nonEmptyString.safeParse).toBe('function');
  });

  it('re-exports the property-image meta schema (mandatory alt)', () => {
    expect(typeof validators.propertyImageMetaSchema.safeParse).toBe('function');
  });

  it('parses a known-good buyer enquiry through the re-exported schema', () => {
    const result = validators.buyerEnquirySchema.safeParse({
      name: 'Albert Aardvark',
      email: 'aardvark@example.invalid',
      message: 'Interested.',
      gdpr_consent: true,
    });
    expect(result.success).toBe(true);
  });
});
