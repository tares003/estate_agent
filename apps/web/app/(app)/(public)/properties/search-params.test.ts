import { describe, expect, it } from 'vitest';
import type { PropertySearch } from '@estate/validators';
import { activeChips, toSearchQuery } from './search-params.js';

const base: PropertySearch = { sort: 'newest', page: 1, unit: 'mi' };

describe('toSearchQuery', () => {
  it('returns an empty string for the canonical no-filter search', () => {
    expect(toSearchQuery(base)).toBe('');
  });

  it('omits the default sort and page', () => {
    expect(toSearchQuery({ ...base, sort: 'newest', page: 1 })).toBe('');
    expect(toSearchQuery({ ...base, sort: 'price_asc' })).toBe('?sort=price_asc');
    expect(toSearchQuery({ ...base, page: 2 })).toBe('?page=2');
  });

  it('serialises location first', () => {
    expect(toSearchQuery({ ...base, location: 'M20', saleType: 'sale' })).toBe(
      '?location=M20&saleType=sale',
    );
  });

  it('serialises a radius search but omits the default miles unit', () => {
    expect(toSearchQuery({ ...base, lat: 51.5, lng: -0.12, radius: 5 })).toBe(
      '?lat=51.5&lng=-0.12&radius=5',
    );
    expect(toSearchQuery({ ...base, lat: 51.5, lng: -0.12, radius: 5, unit: 'km' })).toBe(
      '?lat=51.5&lng=-0.12&radius=5&unit=km',
    );
  });

  it('serialises active filters in a stable key order', () => {
    const q = toSearchQuery({
      ...base,
      saleType: 'rent',
      listingType: 'residential',
      priceMin: 100000,
      bedroomsMin: 2,
    });
    expect(q).toBe('?saleType=rent&listingType=residential&priceMin=100000&bedroomsMin=2');
  });

  it('applies overrides last (pagination link)', () => {
    expect(toSearchQuery({ ...base, saleType: 'sale', page: 1 }, { page: 3 })).toBe(
      '?saleType=sale&page=3',
    );
  });

  it('drops a filter when an override sets it to undefined (clear-one)', () => {
    expect(
      toSearchQuery({ ...base, saleType: 'sale', priceMin: 50000 }, { priceMin: undefined }),
    ).toBe('?saleType=sale');
  });
});

describe('activeChips', () => {
  it('returns no chips for an empty search', () => {
    expect(activeChips(base)).toEqual([]);
  });

  it('renders one radius chip that clears the whole geo search', () => {
    const chips = activeChips({ ...base, lat: 51.5, lng: -0.12, radius: 5, unit: 'mi', page: 2 });
    const radius = chips.find((c) => c.key === 'radius');
    expect(radius?.label).toBe('Within 5 mi');
    expect(radius?.removeQuery).toBe(''); // lat/lng/radius/unit + page all dropped
    expect(activeChips({ ...base, lat: 51.5, lng: -0.12, radius: 3, unit: 'km' })[0]?.label).toBe(
      'Within 3 km',
    );
  });

  it('builds a chip per active filter with a remove query that resets to page 1', () => {
    const chips = activeChips({
      ...base,
      location: 'Didsbury',
      saleType: 'rent',
      listingType: 'new_home',
      priceMin: 100000,
      priceMax: 500000,
      bedroomsMin: 2,
      bathroomsMin: 1,
      page: 4,
    });
    const byKey = Object.fromEntries(chips.map((c) => [c.key, c]));
    expect(byKey['location']?.label).toBe('In Didsbury');
    expect(byKey['saleType']?.label).toBe('To rent');
    expect(byKey['listingType']?.label).toBe('New home');
    expect(byKey['priceMin']?.label).toBe('From £100,000');
    expect(byKey['priceMax']?.label).toBe('Up to £500,000');
    expect(byKey['bedroomsMin']?.label).toBe('2+ beds');
    expect(byKey['bathroomsMin']?.label).toBe('1+ baths');
    // removing the saleType chip drops only it and resets the page
    expect(byKey['saleType']?.removeQuery).not.toContain('saleType');
    expect(byKey['saleType']?.removeQuery).not.toContain('page=4');
    expect(byKey['saleType']?.removeQuery).toContain('listingType=new_home');
  });
});
