import type { PropertySearch } from '@estate/validators';

// EPIC-T FR-T-7/8 — the pure saved-search matching predicate. A saved search's
// stored filters ARE the catalogue `PropertySearch` (the /properties URL is the
// single source of truth for filter state), so "does this new property match my
// saved search" MUST give the same answer as the catalogue's `buildWhere` (apps/web
// lib/properties.ts). This module re-expresses that same predicate in-memory so the
// digest worker matches identically — DB-free, exhaustively unit-testable. The
// catalogue's PostGIS radius path is a later phase there too; this covers the
// always-on core filter bar (location / saleType / listingType / price / beds /
// baths), exactly the fields `buildWhere` encodes.

/** The §J Property columns the matcher reads (a superset of what the digest renders). */
export interface CandidateProperty {
  id: string;
  slug: string;
  displayAddress: string;
  postcode: string;
  title: string | null;
  saleType: string;
  listingType: string;
  marketStatus: string;
  price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  town: string | null;
  /** Null until first published; the catalogue base gate requires it to be set. */
  publishedAt: Date | null;
  /** Soft-delete marker; a deleted property is never public (catalogue base gate). */
  deletedAt: Date | null;
}

/**
 * The catalogue base gate (`buildWhere`: `publishedAt IS NOT NULL AND deletedAt IS
 * NULL`). Only published, non-deleted properties are ever public, so an alert never
 * surfaces a draft or a removed listing.
 */
function isPublic(property: CandidateProperty): boolean {
  return property.publishedAt !== null && property.deletedAt === null;
}

/**
 * The text-location predicate, mirroring the catalogue OR: a case-insensitive town
 * substring OR an uppercased-postcode prefix (e.g. "Didsbury" or "M20"). A null
 * town is tolerated (postcode can still match), exactly as the SQL `OR` does.
 */
function matchesLocation(property: CandidateProperty, location: string): boolean {
  const needle = location.toLowerCase();
  const townHit = property.town !== null && property.town.toLowerCase().includes(needle);
  const postcodeHit = property.postcode.toUpperCase().startsWith(location.toUpperCase());
  return townHit || postcodeHit;
}

/**
 * Whether a property matches a saved search's filters — the in-memory twin of the
 * catalogue `buildWhere` predicate. Every active filter must hold (AND); an absent
 * filter (undefined) is a no-op. A null numeric column (POA price, unstated bed /
 * bath count) fails a min/range filter, matching SQL's `NULL >= n` → false.
 */
export function propertyMatchesSearch(
  filters: PropertySearch,
  property: CandidateProperty,
): boolean {
  if (!isPublic(property)) return false;

  if (filters.saleType !== undefined && property.saleType !== filters.saleType) return false;
  if (filters.listingType !== undefined && property.listingType !== filters.listingType) {
    return false;
  }
  if (filters.location !== undefined && !matchesLocation(property, filters.location)) return false;

  if (filters.priceMin !== undefined) {
    if (property.price === null || property.price < filters.priceMin) return false;
  }
  if (filters.priceMax !== undefined) {
    if (property.price === null || property.price > filters.priceMax) return false;
  }

  if (filters.bedroomsMin !== undefined) {
    if (property.bedrooms === null || property.bedrooms < filters.bedroomsMin) return false;
  }
  if (filters.bathroomsMin !== undefined) {
    if (property.bathrooms === null || property.bathrooms < filters.bathroomsMin) return false;
  }

  return true;
}

/**
 * The new matches for a saved search: candidates that match the filters AND were
 * published strictly after the previous-alert cutoff. A null cutoff (the search has
 * never alerted) treats every current public match as new — the first run is a
 * catch-up. The strict `>` means a property published at the exact previous-alert
 * instant is treated as already-seen (it was current when the last alert fired), so
 * no property is ever alerted twice for the same saved search.
 */
export function findNewMatches(
  filters: PropertySearch,
  candidates: CandidateProperty[],
  since: Date | null,
): CandidateProperty[] {
  return candidates.filter((property) => {
    if (!propertyMatchesSearch(filters, property)) return false;
    if (since === null) return true;
    return property.publishedAt !== null && property.publishedAt.getTime() > since.getTime();
  });
}
