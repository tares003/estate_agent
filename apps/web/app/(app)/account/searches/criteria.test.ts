// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parsePropertySearch } from '@estate/validators';

import { criteriaSummary, runSearchHref } from './criteria.js';

// EPIC-T FR-T-8 — pure presenters for a saved search's stored filters. They reuse
// the catalogue chip/query helpers so a saved search renders + re-runs identically
// to the live /properties filter bar.

describe('criteriaSummary', () => {
  it('joins the active-filter chip labels', () => {
    const filters = parsePropertySearch({
      location: 'Didsbury',
      bedroomsMin: '2',
      saleType: 'rent',
    });
    const summary = criteriaSummary(filters);
    expect(summary).toContain('In Didsbury');
    expect(summary).toContain('To rent');
    expect(summary).toContain('2+ beds');
  });

  it('reads "All properties" when no filter is active', () => {
    expect(criteriaSummary(parsePropertySearch({}))).toBe('All properties');
  });
});

describe('runSearchHref', () => {
  it('builds the /properties query string that re-runs the saved filters', () => {
    const filters = parsePropertySearch({ location: 'Leeds', priceMax: '300000' });
    const href = runSearchHref(filters);
    expect(href.startsWith('/properties?')).toBe(true);
    expect(href).toContain('location=Leeds');
    expect(href).toContain('priceMax=300000');
  });

  it('is the bare /properties path when no filter is active', () => {
    expect(runSearchHref(parsePropertySearch({}))).toBe('/properties');
  });
});
