import { describe, expect, it } from 'vitest';

import {
  PROPERTY_COMMERCIAL_USE_CLASSES,
  PROPERTY_CQC_RATINGS,
  PROPERTY_MARKET_STATUSES,
  PROPERTY_PUBLICATION_STATUSES,
  propertyCreateSchema,
  propertySlugBase,
  propertyWriteUpdateSchema,
  slugify,
  validatePropertyVerticalFields,
} from './property-write.js';

// EPIC-F FR-F-1 / FR-F-4 — the property write schemas + the deterministic slug helper.
// The schemas gate the create/update Server Actions; the slug helper backs FR-F-4's
// auto-generated URL slug. DB-free unit coverage: accept a known-good payload, reject
// the boundary cases, and pin the slug determinism the collision guard relies on.

const CORE = {
  reference: 'REF-001',
  listingType: 'residential',
  saleType: 'sale',
  displayAddress: '12 Acacia Avenue, Chorlton',
  postcode: 'M21 9WN',
} as const;

describe('slugify', () => {
  it('lower-cases, strips accents and hyphenates', () => {
    expect(slugify('Café René & Co')).toBe('cafe-rene-co');
  });

  it('trims leading/trailing separators and collapses runs', () => {
    expect(slugify('  --Flat 2, Block B--  ')).toBe('flat-2-block-b');
  });

  it('is deterministic (same input → same slug)', () => {
    expect(slugify('12 Acacia Avenue')).toBe(slugify('12 Acacia Avenue'));
  });

  it('returns an empty string when no usable characters remain', () => {
    expect(slugify('—/—')).toBe('');
  });
});

describe('propertySlugBase (FR-F-4)', () => {
  it('joins title, town and postcode prefix', () => {
    expect(propertySlugBase({ title: '2 Bed Flat', town: 'Didsbury', postcodePrefix: 'M20' })).toBe(
      '2-bed-flat-didsbury-m20',
    );
  });

  it('skips blank/absent parts', () => {
    expect(propertySlugBase({ title: 'Studio', town: null })).toBe('studio');
    expect(propertySlugBase({ postcodePrefix: '  ' })).toBe('');
  });
});

describe('propertyCreateSchema', () => {
  it('accepts a minimal known-good listing', () => {
    const res = propertyCreateSchema.safeParse(CORE);
    expect(res.success).toBe(true);
  });

  it('accepts the full core field set and normalises the postcode', () => {
    const res = propertyCreateSchema.safeParse({
      ...CORE,
      title: 'Charming Two-Bedroom Flat',
      slug: 'charming-two-bed-flat',
      description: 'A lovely home.',
      keyFeatures: ['Two bedrooms', 'South-facing garden'],
      price: 350000,
      priceQualifier: 'guide_price',
      marketStatus: 'for_sale',
      bedrooms: 2,
      bathrooms: 1,
      category: 'flat',
      tenure: 'leasehold',
      councilTaxBand: 'c',
      epcRating: 'b',
      metaTitle: 'Two-bed flat in Chorlton',
      metaDescription: 'A charming two-bed flat.',
      publicationStatus: 'draft',
      postcode: 'm21 9wn',
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.postcode).toBe('M21 9WN');
      expect(res.data.price).toBe(350000);
    }
  });

  it('rejects a missing display address', () => {
    const res = propertyCreateSchema.safeParse({ ...CORE, displayAddress: '   ' });
    expect(res.success).toBe(false);
  });

  it('rejects an unknown listing type', () => {
    const res = propertyCreateSchema.safeParse({ ...CORE, listingType: 'houseboat' });
    expect(res.success).toBe(false);
  });

  it('rejects an invalid slug (spaces / uppercase punctuation)', () => {
    const res = propertyCreateSchema.safeParse({ ...CORE, slug: 'Not A Slug!' });
    expect(res.success).toBe(false);
  });

  it('rejects a negative price', () => {
    const res = propertyCreateSchema.safeParse({ ...CORE, price: -1 });
    expect(res.success).toBe(false);
  });

  it('rejects an out-of-enum council tax band', () => {
    const res = propertyCreateSchema.safeParse({ ...CORE, councilTaxBand: 'z' });
    expect(res.success).toBe(false);
  });

  it('pins the market + publication status vocabularies to the Prisma enums', () => {
    expect(PROPERTY_MARKET_STATUSES).toContain('for_sale');
    expect(PROPERTY_PUBLICATION_STATUSES).toEqual(['draft', 'in_review', 'published', 'archived']);
  });
});

describe('per-vertical extension fields (FR-F-3)', () => {
  it('accepts the new-home extension fields on a new_home listing', () => {
    const res = propertyCreateSchema.safeParse({
      ...CORE,
      listingType: 'new_home',
      isOffPlan: true,
      developmentName: 'The Waterside',
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.isOffPlan).toBe(true);
      expect(res.data.developmentName).toBe('The Waterside');
    }
  });

  it('accepts the commercial extension fields on a commercial listing', () => {
    const res = propertyCreateSchema.safeParse({
      ...CORE,
      listingType: 'commercial',
      vatPayable: true,
      annualBusinessRates: 12500,
      useClass: 'e',
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.useClass).toBe('e');
    }
  });

  it('accepts the business-transfer extension fields on a business_transfer listing', () => {
    const res = propertyCreateSchema.safeParse({
      ...CORE,
      listingType: 'business_transfer',
      annualTurnover: 450000,
      grossProfit: 180000,
      netProfit: 90000,
      yearsTrading: 12,
      staffCount: 8,
      currentAnnualRent: 24000,
      isConfidential: true,
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.isConfidential).toBe(true);
      expect(res.data.annualTurnover).toBe(450000);
    }
  });

  it('accepts the care-home extension fields on a care_home listing', () => {
    const res = propertyCreateSchema.safeParse({
      ...CORE,
      listingType: 'care_home',
      bedCount: 42,
      cqcRating: 'good',
      cqcInspectionUrl: 'https://www.cqc.org.uk/location/1-234567890',
      isGoingConcern: true,
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.cqcRating).toBe('good');
    }
  });

  it('rejects an out-of-enum CQC rating', () => {
    const res = propertyCreateSchema.safeParse({
      ...CORE,
      listingType: 'care_home',
      cqcRating: 'excellent',
    });
    expect(res.success).toBe(false);
  });

  it('rejects an out-of-enum use class', () => {
    const res = propertyCreateSchema.safeParse({
      ...CORE,
      listingType: 'commercial',
      useClass: 'z9',
    });
    expect(res.success).toBe(false);
  });

  it('rejects a negative business-transfer turnover', () => {
    const res = propertyCreateSchema.safeParse({
      ...CORE,
      listingType: 'business_transfer',
      annualTurnover: -1,
    });
    expect(res.success).toBe(false);
  });

  it('rejects a non-URL CQC inspection link', () => {
    const res = propertyCreateSchema.safeParse({
      ...CORE,
      listingType: 'care_home',
      cqcInspectionUrl: 'not a url',
    });
    expect(res.success).toBe(false);
  });

  it('pins the CQC + use-class vocabularies to their Prisma enums', () => {
    expect(PROPERTY_CQC_RATINGS).toContain('good');
    expect(PROPERTY_COMMERCIAL_USE_CLASSES).toContain('e');
  });
});

describe('validatePropertyVerticalFields (conditional-by-listing-type isolation)', () => {
  it('returns no issue when a vertical field matches its listing type', () => {
    expect(
      validatePropertyVerticalFields('care_home', { bedCount: 40, cqcRating: 'good' }),
    ).toEqual([]);
    expect(validatePropertyVerticalFields('business_transfer', { annualTurnover: 100000 })).toEqual(
      [],
    );
    expect(validatePropertyVerticalFields('commercial', { useClass: 'e' })).toEqual([]);
    expect(validatePropertyVerticalFields('new_home', { isOffPlan: true })).toEqual([]);
  });

  it('flags a commercial field set on a residential listing', () => {
    const issues = validatePropertyVerticalFields('residential', { useClass: 'e' });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.field).toBe('useClass');
  });

  it('flags a business-transfer field set on a care_home listing', () => {
    const issues = validatePropertyVerticalFields('care_home', { annualTurnover: 100000 });
    expect(issues.map((i) => i.field)).toContain('annualTurnover');
  });

  it('flags a care-home field set on a commercial listing', () => {
    const issues = validatePropertyVerticalFields('commercial', {
      cqcRating: 'good',
      bedCount: 20,
    });
    expect(issues.map((i) => i.field).sort()).toEqual(['bedCount', 'cqcRating']);
  });

  it('ignores undefined vertical fields (they are simply not set)', () => {
    expect(
      validatePropertyVerticalFields('residential', {
        useClass: undefined,
        cqcRating: undefined,
      }),
    ).toEqual([]);
  });

  it('does not treat a falsy boolean flag as "set" for isolation', () => {
    // isOffPlan defaults false everywhere; only `true` counts as a new-home assertion.
    expect(validatePropertyVerticalFields('residential', { isOffPlan: false })).toEqual([]);
    expect(validatePropertyVerticalFields('residential', { isConfidential: false })).toEqual([]);
    expect(validatePropertyVerticalFields('residential', { isGoingConcern: false })).toEqual([]);
  });

  it('flags a truthy foreign boolean flag', () => {
    const issues = validatePropertyVerticalFields('residential', { isGoingConcern: true });
    expect(issues.map((i) => i.field)).toContain('isGoingConcern');
  });
});

describe('propertyWriteUpdateSchema', () => {
  const ID = '11111111-1111-1111-1111-111111111111';

  it('accepts an update carrying a new slug', () => {
    const res = propertyWriteUpdateSchema.safeParse({
      id: ID,
      slug: 'renamed-flat',
      displayAddress: '12 Acacia Avenue',
      postcode: 'M21 9WN',
    });
    expect(res.success).toBe(true);
  });

  it('rejects an update with a non-uuid id', () => {
    const res = propertyWriteUpdateSchema.safeParse({
      id: 'not-a-uuid',
      displayAddress: '12 Acacia Avenue',
      postcode: 'M21 9WN',
    });
    expect(res.success).toBe(false);
  });

  it('rejects an update with an invalid slug', () => {
    const res = propertyWriteUpdateSchema.safeParse({
      id: ID,
      slug: 'bad slug',
      displayAddress: '12 Acacia Avenue',
      postcode: 'M21 9WN',
    });
    expect(res.success).toBe(false);
  });
});
