import { describe, expect, it } from 'vitest';

import {
  PROPERTY_MARKET_STATUSES,
  PROPERTY_PUBLICATION_STATUSES,
  propertyCreateSchema,
  propertySlugBase,
  propertyWriteUpdateSchema,
  slugify,
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
