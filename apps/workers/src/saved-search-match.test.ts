import type { PropertySearch } from '@estate/validators';
import { describe, expect, it } from 'vitest';

import {
  findNewMatches,
  propertyMatchesSearch,
  type CandidateProperty,
} from './saved-search-match.js';

// EPIC-T FR-T-7/8 — the pure saved-search matching logic. A saved search's stored
// filters are the catalogue `PropertySearch` shape, so matching MUST agree with the
// catalogue's `buildWhere` predicate (apps/web lib/properties.ts): same published +
// not-deleted base gate, same field semantics. These tests pin that parity DB-free.

/** A catalogue filter object with all-undefined defaults (matches everything). */
function filters(over: Partial<PropertySearch> = {}): PropertySearch {
  return {
    unit: 'mi',
    sort: 'newest',
    page: 1,
    ...over,
  } as PropertySearch;
}

/** A published, non-deleted candidate property with sensible defaults. */
function property(over: Partial<CandidateProperty> = {}): CandidateProperty {
  return {
    id: 'p1',
    slug: 'a-flat',
    displayAddress: '1 High Street',
    postcode: 'M20 2AB',
    title: 'A lovely flat',
    saleType: 'sale',
    listingType: 'residential',
    marketStatus: 'for_sale',
    price: 25_000_000,
    bedrooms: 2,
    bathrooms: 1,
    town: 'Didsbury',
    publishedAt: new Date('2026-06-20T07:00:00Z'),
    deletedAt: null,
    ...over,
  };
}

describe('propertyMatchesSearch', () => {
  it('matches a published, non-deleted property when no filter is set', () => {
    expect(propertyMatchesSearch(filters(), property())).toBe(true);
  });

  it('excludes an unpublished property (publishedAt null), like the catalogue base gate', () => {
    expect(propertyMatchesSearch(filters(), property({ publishedAt: null }))).toBe(false);
  });

  it('excludes a soft-deleted property (deletedAt set)', () => {
    expect(
      propertyMatchesSearch(filters(), property({ deletedAt: new Date('2026-06-21T00:00:00Z') })),
    ).toBe(false);
  });

  it('filters on saleType', () => {
    expect(
      propertyMatchesSearch(filters({ saleType: 'sale' }), property({ saleType: 'sale' })),
    ).toBe(true);
    expect(
      propertyMatchesSearch(filters({ saleType: 'rent' }), property({ saleType: 'sale' })),
    ).toBe(false);
  });

  it('filters on listingType', () => {
    expect(
      propertyMatchesSearch(
        filters({ listingType: 'residential' }),
        property({ listingType: 'residential' }),
      ),
    ).toBe(true);
    expect(
      propertyMatchesSearch(
        filters({ listingType: 'commercial' }),
        property({ listingType: 'residential' }),
      ),
    ).toBe(false);
  });

  it('matches location by case-insensitive town substring (like the catalogue OR)', () => {
    expect(
      propertyMatchesSearch(filters({ location: 'dids' }), property({ town: 'Didsbury' })),
    ).toBe(true);
  });

  it('matches location by uppercased postcode prefix (like the catalogue OR)', () => {
    expect(
      propertyMatchesSearch(
        filters({ location: 'm20' }),
        property({ town: 'Nowhere', postcode: 'M20 2AB' }),
      ),
    ).toBe(true);
  });

  it('rejects a location that matches neither town nor postcode prefix', () => {
    expect(
      propertyMatchesSearch(
        filters({ location: 'leeds' }),
        property({ town: 'Didsbury', postcode: 'M20 2AB' }),
      ),
    ).toBe(false);
  });

  it('tolerates a null town when matching by postcode prefix', () => {
    expect(
      propertyMatchesSearch(
        filters({ location: 'M20' }),
        property({ town: null, postcode: 'M20 2AB' }),
      ),
    ).toBe(true);
  });

  it('filters on priceMin / priceMax (inclusive)', () => {
    const p = property({ price: 25_000_000 });
    expect(propertyMatchesSearch(filters({ priceMin: 25_000_000 }), p)).toBe(true);
    expect(propertyMatchesSearch(filters({ priceMin: 25_000_001 }), p)).toBe(false);
    expect(propertyMatchesSearch(filters({ priceMax: 25_000_000 }), p)).toBe(true);
    expect(propertyMatchesSearch(filters({ priceMax: 24_999_999 }), p)).toBe(false);
  });

  it('excludes a POA (null price) property when a price bound is set', () => {
    const poa = property({ price: null });
    expect(propertyMatchesSearch(filters({ priceMin: 1 }), poa)).toBe(false);
    expect(propertyMatchesSearch(filters({ priceMax: 99_999_999 }), poa)).toBe(false);
    // …but with no price filter, a POA property still matches.
    expect(propertyMatchesSearch(filters(), poa)).toBe(true);
  });

  it('filters on bedroomsMin / bathroomsMin (gte)', () => {
    const p = property({ bedrooms: 2, bathrooms: 1 });
    expect(propertyMatchesSearch(filters({ bedroomsMin: 2 }), p)).toBe(true);
    expect(propertyMatchesSearch(filters({ bedroomsMin: 3 }), p)).toBe(false);
    expect(propertyMatchesSearch(filters({ bathroomsMin: 1 }), p)).toBe(true);
    expect(propertyMatchesSearch(filters({ bathroomsMin: 2 }), p)).toBe(false);
  });

  it('excludes a property with a null bedroom/bathroom count when that minimum is set', () => {
    expect(propertyMatchesSearch(filters({ bedroomsMin: 1 }), property({ bedrooms: null }))).toBe(
      false,
    );
    expect(propertyMatchesSearch(filters({ bathroomsMin: 1 }), property({ bathrooms: null }))).toBe(
      false,
    );
  });

  it('requires every active filter to hold (AND semantics)', () => {
    const p = property({ bedrooms: 2, saleType: 'sale' });
    expect(propertyMatchesSearch(filters({ bedroomsMin: 2, saleType: 'sale' }), p)).toBe(true);
    expect(propertyMatchesSearch(filters({ bedroomsMin: 2, saleType: 'rent' }), p)).toBe(false);
  });
});

describe('findNewMatches', () => {
  const since = new Date('2026-06-19T07:00:00Z');

  it('returns only properties published strictly after the cutoff that match the filters', () => {
    const before = property({ id: 'old', publishedAt: new Date('2026-06-18T07:00:00Z') });
    const atCutoff = property({ id: 'edge', publishedAt: since });
    const after = property({ id: 'new', publishedAt: new Date('2026-06-20T07:00:00Z') });

    const result = findNewMatches(filters(), [before, atCutoff, after], since);
    expect(result.map((p) => p.id)).toEqual(['new']);
  });

  it('treats a null cutoff (never alerted) as "every current match is new"', () => {
    const a = property({ id: 'a', publishedAt: new Date('2020-01-01T00:00:00Z') });
    const b = property({ id: 'b', publishedAt: new Date('2026-06-20T07:00:00Z') });
    const result = findNewMatches(filters(), [a, b], null);
    expect(result.map((p) => p.id).sort()).toEqual(['a', 'b']);
  });

  it('drops non-matching and unpublished/deleted candidates even when newer than the cutoff', () => {
    const newer = new Date('2026-06-25T07:00:00Z');
    const nonMatch = property({ id: 'nm', publishedAt: newer, bedrooms: 1 });
    const unpublished = property({ id: 'up', publishedAt: null });
    const deleted = property({ id: 'del', publishedAt: newer, deletedAt: newer });
    const match = property({ id: 'ok', publishedAt: newer, bedrooms: 3 });

    const result = findNewMatches(
      filters({ bedroomsMin: 3 }),
      [nonMatch, unpublished, deleted, match],
      since,
    );
    expect(result.map((p) => p.id)).toEqual(['ok']);
  });

  it('returns an empty list when nothing new matches', () => {
    const old = property({ id: 'old', publishedAt: new Date('2026-06-01T00:00:00Z') });
    expect(findNewMatches(filters(), [old], since)).toEqual([]);
  });
});
