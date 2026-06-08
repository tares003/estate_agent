import { describe, expect, it } from 'vitest';
import { parsePropertySearch, propertySearchSchema } from './property-search.js';

describe('propertySearchSchema / parsePropertySearch', () => {
  it('defaults to newest sort, page 1 and no filters for an empty query', () => {
    expect(parsePropertySearch({})).toEqual({ sort: 'newest', page: 1 });
  });

  it('parses a full filter set from string query params', () => {
    const result = parsePropertySearch({
      saleType: 'rent',
      listingType: 'residential',
      priceMin: '100000',
      priceMax: '500000',
      bedroomsMin: '2',
      bathroomsMin: '1',
      sort: 'price_asc',
      page: '3',
    });
    expect(result).toEqual({
      saleType: 'rent',
      listingType: 'residential',
      priceMin: 100000,
      priceMax: 500000,
      bedroomsMin: 2,
      bathroomsMin: 1,
      sort: 'price_asc',
      page: 3,
    });
  });

  it('drops unknown enum values rather than erroring (fail-soft)', () => {
    const result = parsePropertySearch({
      saleType: 'lease',
      listingType: 'castle',
      sort: 'random',
    });
    expect(result.saleType).toBeUndefined();
    expect(result.listingType).toBeUndefined();
    expect(result.sort).toBe('newest');
  });

  it('drops non-numeric or negative numeric params', () => {
    const result = parsePropertySearch({ priceMin: 'abc', bedroomsMin: '-2', priceMax: '' });
    expect(result.priceMin).toBeUndefined();
    expect(result.bedroomsMin).toBeUndefined();
    expect(result.priceMax).toBeUndefined();
  });

  it('falls back to page 1 for a zero, negative, junk or absurdly large page', () => {
    expect(parsePropertySearch({ page: '0' }).page).toBe(1);
    expect(parsePropertySearch({ page: '-5' }).page).toBe(1);
    expect(parsePropertySearch({ page: 'nope' }).page).toBe(1);
    // capped so it cannot drive an unbounded OFFSET scan
    expect(parsePropertySearch({ page: '999999999' }).page).toBe(1);
    expect(parsePropertySearch({ page: '10000' }).page).toBe(10000);
  });

  it('drops a price above the £999,999,999 cap (overflow guard)', () => {
    expect(parsePropertySearch({ priceMin: '99999999999' }).priceMin).toBeUndefined();
    expect(parsePropertySearch({ priceMax: '500000000' }).priceMax).toBe(500000000);
  });

  it('keeps the first value when a param is repeated (string[])', () => {
    expect(parsePropertySearch({ saleType: ['sale', 'rent'] }).saleType).toBe('sale');
  });

  it('treats blank strings as "no filter"', () => {
    const result = parsePropertySearch({ saleType: '', listingType: '', bedroomsMin: '' });
    expect(result.saleType).toBeUndefined();
    expect(result.listingType).toBeUndefined();
    expect(result.bedroomsMin).toBeUndefined();
  });

  it('never throws on hostile input', () => {
    expect(() =>
      propertySearchSchema.parse({ priceMin: '<script>', page: '1e9999', sort: ['x', 'y'] }),
    ).not.toThrow();
  });
});
