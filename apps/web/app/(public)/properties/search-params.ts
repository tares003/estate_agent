import { LISTING_TYPES, type ListingTypeFilter, type PropertySearch } from '@estate/validators';

// Pure helpers for the URL-driven catalogue: serialise the active filters to a
// query string (the URL is the single source of truth — master spec §C.10) and
// derive the removable active-filter chips. No DB, no React — unit-tested in
// isolation so the route stays a thin composition.

/** Human labels for the listing-type discriminator (snake_case → display). */
export const LISTING_TYPE_LABELS: Record<ListingTypeFilter, string> = {
  residential: 'Residential',
  new_home: 'New home',
  commercial: 'Commercial',
  business_transfer: 'Business transfer',
  care_home: 'Care home',
  land: 'Land',
};

/** GBP formatter (fixed locale → deterministic in tests / across runtimes). */
const GBP = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
});

/** The query keys we serialise, in a stable order (stable, shareable URLs). */
const KEYS: ReadonlyArray<keyof PropertySearch> = [
  'saleType',
  'listingType',
  'priceMin',
  'priceMax',
  'bedroomsMin',
  'bathroomsMin',
  'sort',
  'page',
];

/**
 * Serialise the active filters to a `/properties` query string (leading `?`, or
 * `''` when nothing is active). Defaults are omitted (sort=newest, page=1) so the
 * canonical "no filters" URL is just `/properties`. `overrides` are applied last
 * (e.g. `{ page: 2 }` for a pagination link, `{ saleType: undefined }` to clear).
 */
export function toSearchQuery(
  search: PropertySearch,
  overrides: Partial<PropertySearch> = {},
): string {
  const merged = { ...search, ...overrides };
  const params = new URLSearchParams();
  for (const key of KEYS) {
    const value = merged[key];
    if (value === undefined) continue;
    if (key === 'sort' && value === 'newest') continue;
    if (key === 'page' && value === 1) continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

/** One active filter, with the query string that removes just it (resets to page 1). */
export interface FilterChip {
  key: keyof PropertySearch;
  label: string;
  removeQuery: string;
}

/**
 * The removable chips for the currently-active filters (master spec §C.10
 * "active filter chips with clear-individual"). Each chip's `removeQuery` drops
 * that one filter and returns to page 1.
 */
export function activeChips(search: PropertySearch): FilterChip[] {
  const chips: FilterChip[] = [];
  const add = (key: keyof PropertySearch, label: string): void => {
    chips.push({ key, label, removeQuery: toSearchQuery(search, { [key]: undefined, page: 1 }) });
  };

  if (search.saleType) add('saleType', search.saleType === 'sale' ? 'For sale' : 'To rent');
  if (search.listingType && LISTING_TYPES.includes(search.listingType)) {
    add('listingType', LISTING_TYPE_LABELS[search.listingType]);
  }
  if (search.priceMin != null) add('priceMin', `From ${GBP.format(search.priceMin)}`);
  if (search.priceMax != null) add('priceMax', `Up to ${GBP.format(search.priceMax)}`);
  if (search.bedroomsMin != null) add('bedroomsMin', `${search.bedroomsMin}+ beds`);
  if (search.bathroomsMin != null) add('bathroomsMin', `${search.bathroomsMin}+ baths`);
  return chips;
}
