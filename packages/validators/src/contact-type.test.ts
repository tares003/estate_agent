import { describe, expect, it } from 'vitest';

import { CONTACT_TYPES, enquiryConversionSchema } from './contact-type.js';

// EPIC-I CRM (FR-I-6): converting an enquiry produces a contact record of one of
// the four party types. The staff member chooses the type at conversion.

const id = '11111111-1111-1111-1111-111111111111';

describe('CONTACT_TYPES', () => {
  it('is the four party types from FR-I-6', () => {
    expect(CONTACT_TYPES).toEqual(['buyer', 'tenant', 'vendor', 'landlord']);
  });
});

describe('enquiryConversionSchema', () => {
  it('accepts a conversion with a chosen contact type', () => {
    expect(
      enquiryConversionSchema.safeParse({ enquiryId: id, contactType: 'vendor' }).success,
    ).toBe(true);
  });

  it('requires a contact type', () => {
    expect(enquiryConversionSchema.safeParse({ enquiryId: id }).success).toBe(false);
  });

  it('rejects an unknown contact type', () => {
    expect(
      enquiryConversionSchema.safeParse({ enquiryId: id, contactType: 'applicant' }).success,
    ).toBe(false);
  });

  it('rejects a non-uuid enquiryId', () => {
    expect(
      enquiryConversionSchema.safeParse({ enquiryId: 'nope', contactType: 'buyer' }).success,
    ).toBe(false);
  });
});
