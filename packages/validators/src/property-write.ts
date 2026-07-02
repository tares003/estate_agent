import { z } from 'zod';

import { nonEmptyString, ukPostcode } from './fields.js';

// EPIC-F FR-F-1 — the admin property WRITE schemas (create + update). This is the
// validated core field set the create/update Server Actions parse before touching the
// DB. It covers a COHERENT CORE from master spec §F / §J: identification (title, slug),
// lifecycle (marketStatus, publicationStatus), pricing (price, priceQualifier),
// specification (bedrooms, bathrooms, category, tenure, councilTaxBand, epcRating),
// location (the address fields), descriptions (description, keyFeatures) and SEO
// (metaTitle, metaDescription). Every enum here mirrors the Prisma enum verbatim —
// the schema is the source of truth (G6).
//
// The per-vertical long-tail (commercial turnover, business-transfer accounts,
// care-home CQC rating, new-home development links — master spec §F.1–§F.6, FR-F-3)
// is intentionally DEFERRED to a follow-on slice; it is validated conditionally on
// listingType there, not here.
//
// This is a staff admin action over business data, not a public personal-data form:
// no GDPR-consent affirmation (G5) and no Turnstile (G8) apply. `displayAddress` /
// `postcode` are the LISTING's public marketing address, not a data subject's details.
//
// pack: core — the property entity is ONE table discriminated by listingType (FR-F-2),
// so this always-on write schema must RECOGNISE every listing-type value (including the
// pack-gated verticals like commercial / business_transfer / care_home / new_home). It
// grants no pack capability itself; which verticals a tenant may author is enforced by
// the pack gate on the calling Server Action + admin UI (EPIC-AD). G12.

/** Max lengths — bound storage and keep the admin table legible. */
export const PROPERTY_TITLE_MAX = 200;
export const PROPERTY_SLUG_MAX = 200;
export const PROPERTY_DESCRIPTION_MAX = 20000;
export const PROPERTY_KEY_FEATURE_MAX = 200;
export const PROPERTY_KEY_FEATURES_MAX = 20;
export const PROPERTY_META_TITLE_MAX = 70;
export const PROPERTY_META_DESCRIPTION_MAX = 200;

/** The property vertical discriminator — mirrors the Prisma `ListingType` enum (FR-F-2). */
export const PROPERTY_LISTING_TYPES = [
  'residential',
  'new_home',
  'commercial',
  'business_transfer',
  'care_home',
  'land',
] as const;
export type PropertyListingType = (typeof PROPERTY_LISTING_TYPES)[number];

/** For sale or to rent — mirrors the Prisma `SaleType` enum. */
export const PROPERTY_SALE_TYPES = ['sale', 'rent'] as const;
export type PropertySaleType = (typeof PROPERTY_SALE_TYPES)[number];

/** The publication lifecycle — mirrors the Prisma `PublicationStatus` enum. */
export const PROPERTY_PUBLICATION_STATUSES = [
  'draft',
  'in_review',
  'published',
  'archived',
] as const;
export type PropertyPublicationStatus = (typeof PROPERTY_PUBLICATION_STATUSES)[number];

/** The market (sale/let) state — mirrors the Prisma `MarketStatus` enum. */
export const PROPERTY_MARKET_STATUSES = [
  'for_sale',
  'under_offer',
  'sold_stc',
  'sold',
  'to_let',
  'let_agreed',
  'let',
  'withdrawn',
] as const;
export type PropertyMarketStatus = (typeof PROPERTY_MARKET_STATUSES)[number];

/** The price qualifier — mirrors the Prisma `PriceQualifier` enum. */
export const PROPERTY_PRICE_QUALIFIERS = [
  'none',
  'offers_in_excess_of',
  'offers_over',
  'offers_in_region_of',
  'guide_price',
  'fixed_price',
  'oiro',
  'poa',
  'from',
] as const;
export type PropertyPriceQualifier = (typeof PROPERTY_PRICE_QUALIFIERS)[number];

/** The property category — mirrors the Prisma `PropertyCategory` enum. */
export const PROPERTY_CATEGORIES = [
  'house',
  'flat',
  'bungalow',
  'studio',
  'maisonette',
  'commercial',
  'land',
  'room',
  'retail',
  'office',
  'industrial',
  'leisure',
  'business',
  'care_home',
  'hmo',
  'mixed_use',
] as const;
export type PropertyCategory = (typeof PROPERTY_CATEGORIES)[number];

/** Tenure — mirrors the Prisma `Tenure` enum. */
export const PROPERTY_TENURES = [
  'freehold',
  'leasehold',
  'share_of_freehold',
  'commonhold',
  'long_leasehold',
  'virtual_freehold',
  'unknown',
] as const;
export type PropertyTenure = (typeof PROPERTY_TENURES)[number];

/** Council tax band — mirrors the Prisma `CouncilTaxBand` enum. */
export const PROPERTY_COUNCIL_TAX_BANDS = [
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h',
  'exempt',
  'unknown',
] as const;
export type PropertyCouncilTaxBand = (typeof PROPERTY_COUNCIL_TAX_BANDS)[number];

/** EPC rating — mirrors the Prisma `EpcRating` enum. */
export const PROPERTY_EPC_RATINGS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'pending'] as const;
export type PropertyEpcRating = (typeof PROPERTY_EPC_RATINGS)[number];

/** Commercial use class — mirrors the Prisma `CommercialUseClass` enum (§F.4, FR-F-3). */
export const PROPERTY_COMMERCIAL_USE_CLASSES = [
  'e',
  'b2',
  'b8',
  'c1',
  'sui_generis',
  'other',
] as const;
export type PropertyCommercialUseClass = (typeof PROPERTY_COMMERCIAL_USE_CLASSES)[number];

/** CQC rating — mirrors the Prisma `CqcRating` enum (§F.6, FR-F-3). */
export const PROPERTY_CQC_RATINGS = [
  'outstanding',
  'good',
  'requires_improvement',
  'inadequate',
  'not_yet_rated',
] as const;
export type PropertyCqcRating = (typeof PROPERTY_CQC_RATINGS)[number];

/** A URL slug: lowercase alphanumerics separated by single hyphens (FR-F-4). */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Derive a URL slug from free text (FR-F-4). Lower-cases, strips accents, replaces
 * every run of non-alphanumerics with a single hyphen and trims leading/trailing
 * hyphens. Deterministic — the same inputs always produce the same slug, which the
 * collision guard (FR-F-11) relies on. Returns `''` for input with no usable
 * characters; the caller supplies a fallback.
 */
export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Build a property slug from its title, town and postcode prefix (FR-F-4). The
 * numeric disambiguation suffix on collision is applied by the write action against
 * the tenant's existing slugs — this helper produces the deterministic BASE slug.
 */
export function propertySlugBase(parts: {
  title?: string | null | undefined;
  town?: string | null | undefined;
  postcodePrefix?: string | null | undefined;
}): string {
  return [parts.title, parts.town, parts.postcodePrefix]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .map((part) => slugify(part))
    .filter((segment) => segment.length > 0)
    .join('-');
}

/** A validated slug field: required, lowercased, matches {@link SLUG_PATTERN}. */
const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Enter a URL slug.')
  .max(PROPERTY_SLUG_MAX)
  .regex(SLUG_PATTERN, 'Use lowercase letters, numbers and hyphens only.');

/** The key-features list: 0–20 short, non-blank tags. */
const keyFeatures = z
  .array(z.string().trim().min(1).max(PROPERTY_KEY_FEATURE_MAX))
  .max(PROPERTY_KEY_FEATURES_MAX)
  .optional();

/** Price in whole pounds (the action converts to the pence the column stores). */
const price = z.number().int().nonnegative().optional();

/** A non-negative small count (bedrooms / bathrooms). */
const count = z.number().int().nonnegative().max(1000).optional();

/**
 * The core fields common to create + update. Optional fields left absent leave the
 * column at its default (create) or unchanged (update); the action maps blanks to
 * `null` where it clears a column.
 */
const coreFields = {
  title: z.string().trim().max(PROPERTY_TITLE_MAX).optional(),
  description: z.string().trim().max(PROPERTY_DESCRIPTION_MAX).optional(),
  keyFeatures,
  price,
  priceQualifier: z.enum(PROPERTY_PRICE_QUALIFIERS).optional(),
  marketStatus: z.enum(PROPERTY_MARKET_STATUSES).optional(),
  bedrooms: count,
  bathrooms: count,
  category: z.enum(PROPERTY_CATEGORIES).optional(),
  tenure: z.enum(PROPERTY_TENURES).optional(),
  councilTaxBand: z.enum(PROPERTY_COUNCIL_TAX_BANDS).optional(),
  epcRating: z.enum(PROPERTY_EPC_RATINGS).optional(),
  metaTitle: z.string().trim().max(PROPERTY_META_TITLE_MAX).optional(),
  metaDescription: z.string().trim().max(PROPERTY_META_DESCRIPTION_MAX).optional(),
  publicationStatus: z.enum(PROPERTY_PUBLICATION_STATUSES).optional(),
  // Location. The display address + postcode are required (every listing is placed);
  // the rest of the address is optional detail.
  displayAddress: nonEmptyString,
  postcode: ukPostcode,
  town: z.string().trim().max(120).optional(),
} as const;

/** A non-negative whole-money amount (turnover / rates / rent, in whole pounds). */
const money = z.number().int().nonnegative().optional();

/**
 * FR-F-3 — the per-vertical EXTENSION fields (master spec §F.3–§F.6), carried on the
 * SAME Property entity discriminated by `listingType` (FR-F-2). Each field belongs to
 * exactly ONE vertical; {@link PROPERTY_VERTICAL_FIELD_OWNERS} records the mapping and
 * {@link validatePropertyVerticalFields} enforces the isolation rule (a residential
 * listing must not carry a commercial use class, a care-home CQC rating, etc.). Whether
 * a tenant may author a vertical at all is a pack gate (EPIC-AD, G12) on the admin form.
 */
const verticalFields = {
  // §F.3 new home
  isOffPlan: z.boolean().optional(),
  developmentName: z.string().trim().max(200).optional(),
  // §F.4 commercial
  vatPayable: z.boolean().optional(),
  annualBusinessRates: money,
  useClass: z.enum(PROPERTY_COMMERCIAL_USE_CLASSES).optional(),
  // §F.5 business transfer
  annualTurnover: money,
  grossProfit: money,
  netProfit: money,
  yearsTrading: z.number().int().nonnegative().max(1000).optional(),
  staffCount: z.number().int().nonnegative().max(1_000_000).optional(),
  currentAnnualRent: money,
  isConfidential: z.boolean().optional(),
  // §F.6 care home
  bedCount: z.number().int().nonnegative().max(100_000).optional(),
  cqcRating: z.enum(PROPERTY_CQC_RATINGS).optional(),
  cqcInspectionUrl: z.string().trim().url().max(2000).optional(),
  isGoingConcern: z.boolean().optional(),
} as const;

/**
 * FR-F-3 — which listing type OWNS each per-vertical extension field. The isolation
 * check ({@link validatePropertyVerticalFields}) rejects a field set on a listing whose
 * type is not its owner. Kept as data (not scattered `if`s) so it round-trips with the
 * admin form's pack-gated subsections and stays the single source of truth.
 */
export const PROPERTY_VERTICAL_FIELD_OWNERS: Readonly<Record<string, PropertyListingType>> = {
  isOffPlan: 'new_home',
  developmentName: 'new_home',
  vatPayable: 'commercial',
  annualBusinessRates: 'commercial',
  useClass: 'commercial',
  annualTurnover: 'business_transfer',
  grossProfit: 'business_transfer',
  netProfit: 'business_transfer',
  yearsTrading: 'business_transfer',
  staffCount: 'business_transfer',
  currentAnnualRent: 'business_transfer',
  isConfidential: 'business_transfer',
  bedCount: 'care_home',
  cqcRating: 'care_home',
  cqcInspectionUrl: 'care_home',
  isGoingConcern: 'care_home',
};

/** A per-vertical isolation violation: an extension field set on the wrong listing type. */
export interface VerticalFieldIssue {
  field: string;
  message: string;
}

/**
 * FR-F-3 — treat a submitted extension value as "set" for isolation purposes. Optional
 * fields left absent (`undefined`) are never set; a boolean flag counts only when TRUE
 * (the flags default to `false` everywhere, so a `false` is not a vertical assertion);
 * any other present value counts as set.
 */
function isVerticalValueSet(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'boolean') return value; // only `true` asserts the vertical
  return true;
}

/**
 * FR-F-3 conditional validation: reject any per-vertical extension field that does not
 * belong to `listingType`. Returns one issue per foreign field (empty when clean). The
 * write actions call this after the base Zod parse and surface the issues as field errors
 * — so "a residential listing does not require business turnover" is enforced structurally,
 * and a residential listing may not smuggle one in either.
 */
export function validatePropertyVerticalFields(
  listingType: PropertyListingType,
  values: Record<string, unknown>,
): VerticalFieldIssue[] {
  const issues: VerticalFieldIssue[] = [];
  for (const [field, owner] of Object.entries(PROPERTY_VERTICAL_FIELD_OWNERS)) {
    if (owner === listingType) continue;
    if (isVerticalValueSet(values[field])) {
      issues.push({
        field,
        message: `The "${field}" field does not apply to a ${listingType.replace(/_/g, ' ')} listing.`,
      });
    }
  }
  return issues;
}

// FR-F-1 — create a property. `reference` and `listingType` + `saleType` anchor the
// record; `slug` is optional here (the action auto-generates it from title/town/
// postcode per FR-F-4 when omitted). The remaining core fields carry the listing's
// initial content, plus the per-vertical extension fields (FR-F-3), validated
// conditionally on `listingType` by the write action.
export const propertyCreateSchema = z.object({
  reference: nonEmptyString,
  listingType: z.enum(PROPERTY_LISTING_TYPES),
  saleType: z.enum(PROPERTY_SALE_TYPES),
  slug: slug.optional(),
  ...coreFields,
  ...verticalFields,
});

/** A validated new-property input. */
export type PropertyCreate = z.infer<typeof propertyCreateSchema>;

// FR-F-1 / FR-F-5 — update a property's core details. `id` names the row; when `slug`
// changes the action auto-creates a 301 redirect from the old path to the new (FR-F-5).
// `listingType` / `saleType` are settable but optional (an edit need not restate them).
export const propertyWriteUpdateSchema = z.object({
  id: z.string().uuid(),
  slug: slug.optional(),
  listingType: z.enum(PROPERTY_LISTING_TYPES).optional(),
  saleType: z.enum(PROPERTY_SALE_TYPES).optional(),
  ...coreFields,
  ...verticalFields,
});

/** A validated property-update input. */
export type PropertyWriteUpdate = z.infer<typeof propertyWriteUpdateSchema>;
