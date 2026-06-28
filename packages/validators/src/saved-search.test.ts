import { describe, expect, it } from 'vitest';

import {
  ALERT_FREQUENCIES,
  SAVED_SEARCH_NAME_MAX,
  savedSearchCreateSchema,
  savedSearchUpdateSchema,
} from './saved-search.js';

// EPIC-T FR-T-7/8 — saving and managing a named saved search. The `searchName` is a
// required short label (named distinctly from a person's `name` so the schema stays
// out of the G5 personal-data heuristic); the `filters` reuse the catalogue
// `propertySearchSchema` (so a saved search round-trips the exact /properties filter
// shape); the alert cadence is one of off / instant / daily / weekly and defaults to
// off. No personal data, so no GDPR-consent affirmation (authenticated customer
// write).

describe('savedSearchCreateSchema (FR-T-7)', () => {
  it('accepts a named search with filters and an explicit cadence', () => {
    const parsed = savedSearchCreateSchema.parse({
      searchName: '  Two-bed flats in Didsbury  ',
      filters: { location: 'Didsbury', bedroomsMin: '2', saleType: 'rent' },
      alertFrequency: 'daily',
    });
    expect(parsed.searchName).toBe('Two-bed flats in Didsbury'); // trimmed
    expect(parsed.alertFrequency).toBe('daily');
    // Filters are normalised through the catalogue schema (string → number, defaults).
    expect(parsed.filters.location).toBe('Didsbury');
    expect(parsed.filters.bedroomsMin).toBe(2);
    expect(parsed.filters.saleType).toBe('rent');
    expect(parsed.filters.sort).toBe('newest');
    expect(parsed.filters.page).toBe(1);
  });

  it('defaults the cadence to off when omitted', () => {
    const parsed = savedSearchCreateSchema.parse({ searchName: 'Anything', filters: {} });
    expect(parsed.alertFrequency).toBe('off');
  });

  it('rejects a blank / whitespace-only name', () => {
    expect(
      savedSearchCreateSchema.safeParse({ searchName: '   ', filters: {}, alertFrequency: 'off' })
        .success,
    ).toBe(false);
  });

  it('rejects a name over the max length', () => {
    const long = 'x'.repeat(SAVED_SEARCH_NAME_MAX + 1);
    expect(savedSearchCreateSchema.safeParse({ searchName: long, filters: {} }).success).toBe(
      false,
    );
  });

  it('rejects an unknown alert cadence', () => {
    expect(
      savedSearchCreateSchema.safeParse({
        searchName: 'Search',
        filters: {},
        alertFrequency: 'hourly',
      }).success,
    ).toBe(false);
  });

  it('fails soft on a hostile filter param rather than throwing', () => {
    const parsed = savedSearchCreateSchema.parse({
      searchName: 'Search',
      filters: { priceMin: 'not-a-number', page: '999999999999' },
    });
    // The catalogue schema drops the malformed price and caps the page.
    expect(parsed.filters.priceMin).toBeUndefined();
    expect(parsed.filters.page).toBe(1);
  });
});

describe('savedSearchUpdateSchema (FR-T-8)', () => {
  it('lists the four cadences', () => {
    expect(ALERT_FREQUENCIES).toEqual(['off', 'instant', 'daily', 'weekly']);
  });

  it('accepts a rename + cadence change', () => {
    const parsed = savedSearchUpdateSchema.parse({
      searchName: '  Renamed search ',
      alertFrequency: 'weekly',
    });
    expect(parsed).toEqual({ searchName: 'Renamed search', alertFrequency: 'weekly' });
  });

  it('defaults the cadence to off when omitted', () => {
    expect(savedSearchUpdateSchema.parse({ searchName: 'Search' }).alertFrequency).toBe('off');
  });

  it('rejects a blank name', () => {
    expect(
      savedSearchUpdateSchema.safeParse({ searchName: '', alertFrequency: 'off' }).success,
    ).toBe(false);
  });

  it('rejects an unknown cadence', () => {
    expect(
      savedSearchUpdateSchema.safeParse({ searchName: 'Search', alertFrequency: 'monthly' })
        .success,
    ).toBe(false);
  });
});
