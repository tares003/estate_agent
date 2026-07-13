import type { PropertySearch } from '@estate/validators';
import { describe, expect, it } from 'vitest';

import { propertyMatchesSearch, type CandidateProperty } from './saved-search-match.js';

// EPIC-T FR-T-7/8 parity harness (audit saved-search-matcher-parity-drift).
//
// propertyMatchesSearch is a hand-maintained in-memory twin of the catalogue
// predicate `buildWhere` (apps/web/app/(app)/lib/properties.ts) fed through the
// catalogue route's `toOptions` mapping (apps/web/app/(app)/(public)/properties/
// page.tsx — the seam that converts the URL's POUNDS price bounds ×100 into the
// PENCE the `price` column stores). We deliberately do NOT import across apps;
// instead each fixture below ENCODES the catalogue decision for one (filters,
// property) pair, hand-derived from buildWhere + toOptions, with the source line
// it mirrors. If a filter's catalogue semantics change (a new filter in
// buildWhere, a changed operator, a changed unit seam), the fixture table must be
// re-derived — and until the matcher is updated to agree, this suite fails,
// making silent drift between digest alerts and catalogue results impossible.
//
// Scope note: `addedWithin` (buildWhere's publishedAt gte cutoff) is deliberately
// NOT a matcher concern — findNewMatches' published-after-cutoff subsumes it (see
// saved-search-match.ts) — and the PostGIS radius path is a later phase there
// too, so neither appears in this table.

/** One parity fixture: the saved filters, the candidate row, and the decision the catalogue would make. */
interface ParityFixture {
  name: string;
  /** The buildWhere/toOptions behaviour this fixture pins. */
  encodes: string;
  filters: Partial<PropertySearch>;
  property: Partial<CandidateProperty>;
  /** Would the catalogue (buildWhere via toOptions) include this row? */
  catalogueIncludes: boolean;
}

/** A saved search's stored filter object (the /properties URL shape; prices in POUNDS). */
function filters(over: Partial<PropertySearch>): PropertySearch {
  return { unit: 'mi', sort: 'newest', page: 1, ...over } as PropertySearch;
}

/** A published, non-deleted §J property row (price in PENCE, as the DB stores it). */
function property(over: Partial<CandidateProperty>): CandidateProperty {
  return {
    id: 'p1',
    slug: 'a-flat',
    displayAddress: '1 High Street',
    postcode: 'M20 2AB',
    title: 'A lovely flat',
    saleType: 'sale',
    listingType: 'residential',
    marketStatus: 'for_sale',
    price: 25_000_000, // £250,000
    bedrooms: 2,
    bathrooms: 1,
    town: 'Didsbury',
    publishedAt: new Date('2026-06-20T07:00:00Z'),
    deletedAt: null,
    ...over,
  };
}

const FIXTURES: ParityFixture[] = [
  // ── Base gate ─────────────────────────────────────────────────────────────
  {
    name: 'published, non-deleted row with no filters',
    encodes: 'buildWhere base: publishedAt { not: null } AND deletedAt: null',
    filters: {},
    property: {},
    catalogueIncludes: true,
  },
  {
    name: 'unpublished row (publishedAt null)',
    encodes: 'buildWhere base: publishedAt { not: null } excludes drafts',
    filters: {},
    property: { publishedAt: null },
    catalogueIncludes: false,
  },
  {
    name: 'soft-deleted row',
    encodes: 'buildWhere base: deletedAt: null excludes soft-deleted rows',
    filters: {},
    property: { deletedAt: new Date('2026-06-21T00:00:00Z') },
    catalogueIncludes: false,
  },
  // ── saleType / listingType (exact equality) ───────────────────────────────
  {
    name: 'saleType filter matching the row',
    encodes: "buildWhere: where['saleType'] = options.saleType (equality)",
    filters: { saleType: 'sale' },
    property: { saleType: 'sale' },
    catalogueIncludes: true,
  },
  {
    name: 'saleType filter differing from the row',
    encodes: "buildWhere: where['saleType'] equality excludes the other saleType",
    filters: { saleType: 'rent' },
    property: { saleType: 'sale' },
    catalogueIncludes: false,
  },
  {
    name: 'listingType filter matching the row',
    encodes: "buildWhere: where['listingType'] = options.listingType (equality)",
    filters: { listingType: 'residential' },
    property: { listingType: 'residential' },
    catalogueIncludes: true,
  },
  {
    name: 'listingType filter differing from the row',
    encodes: "buildWhere: where['listingType'] equality excludes other listing types",
    filters: { listingType: 'commercial' },
    property: { listingType: 'residential' },
    catalogueIncludes: false,
  },
  // ── §C.10 New Homes Only ──────────────────────────────────────────────────
  {
    name: 'newHomesOnly toggle with a new-build row',
    encodes: "buildWhere: if (options.newHomesOnly) where['isNewHome'] = true",
    filters: { newHomesOnly: true },
    property: { isNewHome: true },
    catalogueIncludes: true,
  },
  {
    name: 'newHomesOnly toggle with a non-new-build row',
    encodes: "buildWhere: isNewHome = true excludes isNewHome false",
    filters: { newHomesOnly: true },
    property: { isNewHome: false },
    catalogueIncludes: false,
  },
  {
    name: 'no newHomesOnly toggle ignores the column',
    encodes: 'buildWhere: toggle unset adds no isNewHome clause',
    filters: {},
    property: { isNewHome: false },
    catalogueIncludes: true,
  },
  // ── Location (town substring OR postcode prefix) ──────────────────────────
  {
    name: 'location matching the town case-insensitively',
    encodes: "buildWhere OR[0]: town { contains: location, mode: 'insensitive' }",
    filters: { location: 'dids' },
    property: { town: 'Didsbury' },
    catalogueIncludes: true,
  },
  {
    name: 'location matching an uppercased postcode prefix',
    encodes: 'buildWhere OR[1]: postcode { startsWith: location.toUpperCase() }',
    filters: { location: 'm20' },
    property: { town: 'Nowhere', postcode: 'M20 2AB' },
    catalogueIncludes: true,
  },
  {
    name: 'location matching neither town nor postcode',
    encodes: 'buildWhere OR: both branches false excludes the row',
    filters: { location: 'leeds' },
    property: { town: 'Didsbury', postcode: 'M20 2AB' },
    catalogueIncludes: false,
  },
  {
    name: 'null town still matches by postcode prefix',
    encodes: 'buildWhere OR: SQL NULL town fails contains, postcode branch still matches',
    filters: { location: 'M20' },
    property: { town: null, postcode: 'M20 2AB' },
    catalogueIncludes: true,
  },
  // ── Price (the POUNDS→PENCE seam: toOptions multiplies the URL bounds ×100) ─
  {
    name: 'priceMax in pounds above the pence price',
    encodes: 'toOptions: priceMax ×100 → buildWhere price.lte (300000×100 ≥ 25000000)',
    filters: { priceMax: 300_000 },
    property: { price: 25_000_000 },
    catalogueIncludes: true,
  },
  {
    name: 'priceMax in pounds below the pence price',
    encodes: 'toOptions: priceMax ×100 → buildWhere price.lte (200000×100 < 25000000)',
    filters: { priceMax: 200_000 },
    property: { price: 25_000_000 },
    catalogueIncludes: false,
  },
  {
    name: 'priceMin in pounds below the pence price',
    encodes: 'toOptions: priceMin ×100 → buildWhere price.gte (200000×100 ≤ 25000000)',
    filters: { priceMin: 200_000 },
    property: { price: 25_000_000 },
    catalogueIncludes: true,
  },
  {
    name: 'priceMin in pounds above the pence price',
    encodes: 'toOptions: priceMin ×100 → buildWhere price.gte (300000×100 > 25000000)',
    filters: { priceMin: 300_000 },
    property: { price: 25_000_000 },
    catalogueIncludes: false,
  },
  {
    name: 'priceMin exactly at the price (inclusive gte)',
    encodes: 'buildWhere price.gte is inclusive (250000×100 = 25000000)',
    filters: { priceMin: 250_000 },
    property: { price: 25_000_000 },
    catalogueIncludes: true,
  },
  {
    name: 'priceMax exactly at the price (inclusive lte)',
    encodes: 'buildWhere price.lte is inclusive (250000×100 = 25000000)',
    filters: { priceMax: 250_000 },
    property: { price: 25_000_000 },
    catalogueIncludes: true,
  },
  {
    name: 'price band around the price',
    encodes: 'toOptions: both bounds ×100 → buildWhere price { gte, lte } band',
    filters: { priceMin: 200_000, priceMax: 300_000 },
    property: { price: 25_000_000 },
    catalogueIncludes: true,
  },
  {
    name: 'POA (null price) row with a price bound',
    encodes: 'SQL: NULL price fails gte/lte, so buildWhere excludes POA when a bound is set',
    filters: { priceMax: 300_000 },
    property: { price: null },
    catalogueIncludes: false,
  },
  {
    name: 'POA (null price) row with no price bound',
    encodes: 'buildWhere: no price clause added when both bounds are unset',
    filters: {},
    property: { price: null },
    catalogueIncludes: true,
  },
  // ── Beds / baths (gte, counts — no unit seam) ─────────────────────────────
  {
    name: 'bedroomsMin at the row count (inclusive gte)',
    encodes: 'buildWhere: bedrooms { gte: bedroomsMin } (2 ≥ 2)',
    filters: { bedroomsMin: 2 },
    property: { bedrooms: 2 },
    catalogueIncludes: true,
  },
  {
    name: 'bedroomsMin above the row count',
    encodes: 'buildWhere: bedrooms { gte: bedroomsMin } (2 < 3)',
    filters: { bedroomsMin: 3 },
    property: { bedrooms: 2 },
    catalogueIncludes: false,
  },
  {
    name: 'null bedrooms with a bedroomsMin',
    encodes: 'SQL: NULL bedrooms fails gte, so buildWhere excludes the row',
    filters: { bedroomsMin: 1 },
    property: { bedrooms: null },
    catalogueIncludes: false,
  },
  {
    name: 'bathroomsMin at the row count (inclusive gte)',
    encodes: 'buildWhere: bathrooms { gte: bathroomsMin } (1 ≥ 1)',
    filters: { bathroomsMin: 1 },
    property: { bathrooms: 1 },
    catalogueIncludes: true,
  },
  {
    name: 'bathroomsMin above the row count',
    encodes: 'buildWhere: bathrooms { gte: bathroomsMin } (1 < 2)',
    filters: { bathroomsMin: 2 },
    property: { bathrooms: 1 },
    catalogueIncludes: false,
  },
  {
    name: 'null bathrooms with a bathroomsMin',
    encodes: 'SQL: NULL bathrooms fails gte, so buildWhere excludes the row',
    filters: { bathroomsMin: 1 },
    property: { bathrooms: null },
    catalogueIncludes: false,
  },
  // ── AND composition ───────────────────────────────────────────────────────
  {
    name: 'every active filter holding together',
    encodes: 'buildWhere: all clauses are ANDed on one where object',
    filters: {
      saleType: 'sale',
      location: 'M20',
      priceMin: 200_000,
      priceMax: 300_000,
      bedroomsMin: 2,
      bathroomsMin: 1,
    },
    property: {},
    catalogueIncludes: true,
  },
  {
    name: 'one failing filter among passing ones',
    encodes: 'buildWhere AND: a single failing clause (price.lte) excludes the row',
    filters: { saleType: 'sale', location: 'M20', bedroomsMin: 2, priceMax: 200_000 },
    property: {},
    catalogueIncludes: false,
  },
];

describe('propertyMatchesSearch ↔ catalogue buildWhere parity', () => {
  it.each(FIXTURES)('$name — $encodes', (fixture) => {
    expect(propertyMatchesSearch(filters(fixture.filters), property(fixture.property))).toBe(
      fixture.catalogueIncludes,
    );
  });
});
