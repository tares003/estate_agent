import { describe, expect, it } from 'vitest';

import { propertyUpdateSchema } from './property-update.js';

const id = '11111111-1111-1111-1111-111111111111';
const base = { id, displayAddress: '1 Palatine Road', postcode: 'M20 6RE' };

describe('propertyUpdateSchema', () => {
  it('accepts a minimal update (only the required fields)', () => {
    expect(propertyUpdateSchema.safeParse(base).success).toBe(true);
  });

  it('accepts the full set of optional fields', () => {
    const result = propertyUpdateSchema.safeParse({
      ...base,
      title: 'Edwardian semi',
      price: 525000,
      bedrooms: 4,
      bathrooms: 2,
      receptions: 2,
      description: 'A handsome semi.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-uuid id, a missing address, and a bad postcode', () => {
    expect(propertyUpdateSchema.safeParse({ ...base, id: 'nope' }).success).toBe(false);
    expect(propertyUpdateSchema.safeParse({ ...base, displayAddress: '' }).success).toBe(false);
    expect(propertyUpdateSchema.safeParse({ ...base, postcode: 'not-a-postcode' }).success).toBe(
      false,
    );
  });

  it('rejects a negative price / bedrooms', () => {
    expect(propertyUpdateSchema.safeParse({ ...base, price: -1 }).success).toBe(false);
    expect(propertyUpdateSchema.safeParse({ ...base, bedrooms: -2 }).success).toBe(false);
  });
});
