/**
 * Property-catalogue search/filter/sort/pagination parameters (master spec §C.10
 * filter bar + §K.1 public capability). The public `/properties` URL is the
 * single source of truth for filter state, so this schema parses raw query-string
 * values into a typed, normalised filter object.
 *
 * It is deliberately FAIL-SOFT: every field is optional and `.catch`-guarded, so
 * a malformed or hostile query param is dropped rather than 500-ing a public,
 * cacheable page. No personal data is captured (read-only search), so there is
 * no consent affirmation here (unlike the form schemas).
 *
 * Scope note: the radius (PostGIS), saved-search, and advanced status/added-within
 * toggles in §C.10 are later-phase; this covers the always-on core filter bar.
 */

import { z } from 'zod';

// pack: core — this is the always-on catalogue search-param parser. It must
// RECOGNISE every listing-type value (including the pack-gated verticals like
// commercial / business_transfer) so a URL parses for any tenant; it grants no
// pack capability itself. Which listing types a tenant may use is enforced at
// the visibility layer (pack-gated properties are not in public lists) and the
// filter UI offers only enabled packs (EPIC-AD; see audit D-017). G12.

/** Sort options offered by the catalogue "Order By" control (master spec feature #17). */
export const PROPERTY_SORTS = ['newest', 'oldest', 'price_asc', 'price_desc'] as const;
export type PropertySort = (typeof PROPERTY_SORTS)[number];

/** The listing-type discriminator values (mirrors the Prisma `ListingType` enum). */
export const LISTING_TYPES = [
  'residential',
  'new_home',
  'commercial',
  'business_transfer',
  'care_home',
  'land',
] as const;
export type ListingTypeFilter = (typeof LISTING_TYPES)[number];

/** Default results-per-page (master spec §H.19 says configurable; this is the V1 default). */
export const DEFAULT_PAGE_SIZE = 24;

/** Map an empty string / null to undefined so a present-but-blank param is "no filter". */
const blankToUndefined = (value: unknown): unknown =>
  value === '' || value === null ? undefined : value;

/** An optional non-negative integer parsed from a string; invalid input is dropped. */
const optionalCount = z.preprocess(
  blankToUndefined,
  z.coerce.number().int().min(0).max(99).optional().catch(undefined),
);

/**
 * An optional non-negative price in POUNDS (£) parsed from the URL; invalid input
 * is dropped. The route multiplies by 100 to the pence the `price` column stores.
 * Capped at £999,999,999 so the ×100 conversion stays well inside a safe integer.
 */
const optionalPounds = z.preprocess(
  blankToUndefined,
  z.coerce.number().int().min(0).max(999_999_999).optional().catch(undefined),
);

/** An optional enum value; anything not in the set is dropped (treated as "no filter"). */
const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(blankToUndefined, z.enum(values).optional().catch(undefined));

export const propertySearchSchema = z.object({
  saleType: optionalEnum(['sale', 'rent'] as const),
  listingType: optionalEnum(LISTING_TYPES),
  priceMin: optionalPounds,
  priceMax: optionalPounds,
  bedroomsMin: optionalCount,
  bathroomsMin: optionalCount,
  sort: z.preprocess(blankToUndefined, z.enum(PROPERTY_SORTS).catch('newest').default('newest')),
  // Capped so an absurd ?page=1e9 can't drive an unbounded OFFSET scan (fails soft to 1).
  page: z.preprocess(
    blankToUndefined,
    z.coerce.number().int().min(1).max(10_000).catch(1).default(1),
  ),
});

/** The normalised filter object the catalogue route + repository consume. */
export type PropertySearch = z.infer<typeof propertySearchSchema>;

/**
 * Parse Next's `searchParams` (string | string[] | undefined per key) into a
 * {@link PropertySearch}. Array values keep their first entry. Never throws —
 * every field fails soft to undefined / its default.
 */
export function parsePropertySearch(
  raw: Record<string, string | string[] | undefined>,
): PropertySearch {
  const first: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(raw)) {
    first[key] = Array.isArray(value) ? value[0] : value;
  }
  return propertySearchSchema.parse(first);
}
