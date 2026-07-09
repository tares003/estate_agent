import { describe, expect, it } from 'vitest';
import {
  ADDED_WITHIN_WINDOWS,
  addedWithinCutoff,
  parsePropertySearch,
  propertySearchSchema,
  radiusToMetres,
} from './property-search.js';

describe('propertySearchSchema / parsePropertySearch', () => {
  it('defaults to newest sort, page 1, miles unit and no filters for an empty query', () => {
    expect(parsePropertySearch({})).toEqual({ sort: 'newest', page: 1, unit: 'mi' });
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
      unit: 'mi',
    });
  });

  it('parses a radius search (lat/lng/radius) and defaults the unit to miles', () => {
    const result = parsePropertySearch({ lat: '51.5074', lng: '-0.1278', radius: '5' });
    expect(result).toMatchObject({ lat: 51.5074, lng: -0.1278, radius: 5, unit: 'mi' });
    expect(parsePropertySearch({ unit: 'km' }).unit).toBe('km');
    expect(parsePropertySearch({ unit: 'parsec' }).unit).toBe('mi'); // unknown → default
  });

  it('drops out-of-range coordinates and a non-positive / over-cap radius', () => {
    expect(parsePropertySearch({ lat: '200' }).lat).toBeUndefined();
    expect(parsePropertySearch({ lng: '-999' }).lng).toBeUndefined();
    expect(parsePropertySearch({ radius: '0' }).radius).toBeUndefined();
    expect(parsePropertySearch({ radius: '1000' }).radius).toBeUndefined();
  });

  it('radiusToMetres converts miles and km to whole metres', () => {
    expect(radiusToMetres(5, 'mi')).toBe(8047); // 5 * 1609.344
    expect(radiusToMetres(5, 'km')).toBe(5000);
    expect(radiusToMetres(1, 'mi')).toBe(1609);
  });

  it('trims a location and drops a blank or over-long one', () => {
    expect(parsePropertySearch({ location: '  Didsbury  ' }).location).toBe('Didsbury');
    expect(parsePropertySearch({ location: '   ' }).location).toBeUndefined();
    expect(parsePropertySearch({ location: '' }).location).toBeUndefined();
    expect(parsePropertySearch({ location: 'x'.repeat(101) }).location).toBeUndefined();
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

describe('advanced filters (§C.10 modal — New Homes Only + added-to-site window)', () => {
  it('parses the New Homes Only toggle from checkbox-style truthy values', () => {
    expect(parsePropertySearch({ newHomesOnly: 'on' }).newHomesOnly).toBe(true);
    expect(parsePropertySearch({ newHomesOnly: 'true' }).newHomesOnly).toBe(true);
    expect(parsePropertySearch({ newHomesOnly: '1' }).newHomesOnly).toBe(true);
  });

  it('treats an absent, blank or unrecognised toggle value as "no filter" (never false)', () => {
    expect(parsePropertySearch({}).newHomesOnly).toBeUndefined();
    expect(parsePropertySearch({ newHomesOnly: '' }).newHomesOnly).toBeUndefined();
    expect(parsePropertySearch({ newHomesOnly: 'false' }).newHomesOnly).toBeUndefined();
    expect(parsePropertySearch({ newHomesOnly: 'banana' }).newHomesOnly).toBeUndefined();
  });

  it('parses each added-within window and drops an unknown one', () => {
    for (const window of ADDED_WITHIN_WINDOWS) {
      expect(parsePropertySearch({ addedWithin: window }).addedWithin).toBe(window);
    }
    expect(parsePropertySearch({ addedWithin: '1y' }).addedWithin).toBeUndefined();
    expect(parsePropertySearch({ addedWithin: '' }).addedWithin).toBeUndefined();
  });

  it('derives the published-at cutoff for each window relative to the supplied now', () => {
    const now = new Date('2026-07-09T12:00:00Z');
    expect(addedWithinCutoff('24h', now)).toEqual(new Date('2026-07-08T12:00:00Z'));
    expect(addedWithinCutoff('3d', now)).toEqual(new Date('2026-07-06T12:00:00Z'));
    expect(addedWithinCutoff('7d', now)).toEqual(new Date('2026-07-02T12:00:00Z'));
    expect(addedWithinCutoff('14d', now)).toEqual(new Date('2026-06-25T12:00:00Z'));
  });
});
