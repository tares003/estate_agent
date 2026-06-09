// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { propertyGridBlockSchema, propertyGridToOptions } from './property-grid-options.js';

// EPIC-D FR-D-2 `property_grid` (B27). The block's data is filter CONFIG (not the
// rendered output); the async renderer fetches matching properties. This tests the
// pure parts: the config schema + the config -> catalogue-search-options mapping.

describe('propertyGridBlockSchema', () => {
  it('accepts an empty config — every field is optional', () => {
    expect(propertyGridBlockSchema.safeParse({}).success).toBe(true);
  });

  it('constrains saleType to sale|rent and limit to a positive integer', () => {
    expect(propertyGridBlockSchema.safeParse({ saleType: 'lease' }).success).toBe(false);
    expect(propertyGridBlockSchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(propertyGridBlockSchema.safeParse({ limit: 1.5 }).success).toBe(false);
    expect(
      propertyGridBlockSchema.safeParse({ heading: 'Featured', saleType: 'rent', limit: 4 })
        .success,
    ).toBe(true);
  });
});

describe('propertyGridToOptions', () => {
  it('defaults to page 1, six results, no filters', () => {
    expect(propertyGridToOptions({})).toEqual({ page: 1, pageSize: 6 });
  });

  it('passes saleType + listingType through as catalogue filters', () => {
    expect(propertyGridToOptions({ saleType: 'rent', listingType: 'commercial' })).toMatchObject({
      saleType: 'rent',
      listingType: 'commercial',
    });
  });

  it('maps limit to pageSize, clamped to 1..24', () => {
    expect(propertyGridToOptions({ limit: 3 }).pageSize).toBe(3);
    expect(propertyGridToOptions({ limit: 100 }).pageSize).toBe(24);
    expect(propertyGridToOptions({ limit: 0 as never }).pageSize).toBe(1);
  });

  it('never carries the presentational heading into the search options', () => {
    expect('heading' in propertyGridToOptions({ heading: 'Featured' })).toBe(false);
  });
});
