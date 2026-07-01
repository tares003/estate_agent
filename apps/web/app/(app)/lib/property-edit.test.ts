// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import {
  getPropertyForEdit,
  normaliseKeyFeatures,
  type PropertyEditReader,
} from './property-edit.js';

function rawRow(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'p1',
    reference: 'REF-001',
    listingType: 'residential',
    saleType: 'sale',
    slug: 'charming-two-bed-flat-chorlton-m21',
    title: 'Charming Two-Bed Flat',
    price: 35_000_000,
    priceQualifier: 'guide_price',
    marketStatus: 'for_sale',
    bedrooms: 2,
    bathrooms: 1,
    category: 'flat',
    tenure: 'leasehold',
    councilTaxBand: 'b',
    epcRating: 'c',
    displayAddress: '12 Acacia Avenue, Chorlton',
    postcode: 'M21 9WN',
    town: 'Chorlton',
    description: 'A charming flat.',
    keyFeatures: ['Two bedrooms', 'Allocated parking'],
    metaTitle: 'Two-bed flat in Chorlton',
    metaDescription: 'A lovely two-bed flat.',
    publicationStatus: 'draft',
    ...over,
  };
}

function reader(result: Record<string, unknown> | null): {
  db: PropertyEditReader;
  calls: unknown[];
} {
  const calls: unknown[] = [];
  const db: PropertyEditReader = {
    property: {
      findFirst: vi.fn(async (args) => {
        calls.push(args);
        return result as never;
      }),
    },
  };
  return { db, calls };
}

describe('normaliseKeyFeatures', () => {
  it('keeps only non-empty strings and drops non-array / non-string values', () => {
    expect(normaliseKeyFeatures(['A', '', 'B', 3, null])).toEqual(['A', 'B']);
    expect(normaliseKeyFeatures('nope')).toEqual([]);
    expect(normaliseKeyFeatures(null)).toEqual([]);
  });
});

describe('getPropertyForEdit', () => {
  it('loads a listing by id, drafts included, soft-deleted excluded', async () => {
    const { db, calls } = reader(rawRow());
    const result = await getPropertyForEdit(db, 'p1');
    expect(result?.id).toBe('p1');
    expect(result?.slug).toBe('charming-two-bed-flat-chorlton-m21');
    expect(result?.keyFeatures).toEqual(['Two bedrooms', 'Allocated parking']);
    expect(calls[0]).toEqual({ where: { id: 'p1', deletedAt: null } });
  });

  it('maps every core field the write schema accepts', async () => {
    const { db } = reader(rawRow());
    const result = await getPropertyForEdit(db, 'p1');
    expect(result).toMatchObject({
      reference: 'REF-001',
      listingType: 'residential',
      saleType: 'sale',
      priceQualifier: 'guide_price',
      category: 'flat',
      tenure: 'leasehold',
      councilTaxBand: 'b',
      epcRating: 'c',
      town: 'Chorlton',
      metaTitle: 'Two-bed flat in Chorlton',
      publicationStatus: 'draft',
    });
  });

  it('coerces a non-array keyFeatures value to an empty list', async () => {
    const { db } = reader(rawRow({ keyFeatures: null }));
    const result = await getPropertyForEdit(db, 'p1');
    expect(result?.keyFeatures).toEqual([]);
  });

  it('returns null when there is no such listing', async () => {
    const { db } = reader(null);
    expect(await getPropertyForEdit(db, 'missing')).toBeNull();
  });
});
