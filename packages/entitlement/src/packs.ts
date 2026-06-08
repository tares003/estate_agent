// pack: core
/**
 * The pack catalogue (EPIC-AD / PRODUCT.md §5a).
 *
 * This file is the single source of truth for the optional pack slugs. It is
 * itself core platform infrastructure — the `// pack: core` marker above
 * declares to CI guard G12 that this catalogue is always-on, so it may name
 * every non-core slug without each one needing its own gate.
 *
 * `core` is the implicit always-on pack: every tenant has it, it is never
 * stored in `platform.tenants.enabled_packs`, and it is therefore absent from
 * `OPTIONAL_PACK_SLUGS`. It appears only in `ALL_PACK_SLUGS` for completeness.
 */

/** The eleven optional (purchasable add-on) pack slugs, in catalogue order. */
export const OPTIONAL_PACK_SLUGS = [
  'sales_plus',
  'new_homes',
  'commercial',
  'business_transfer',
  'care_homes',
  'portal_syndication',
  'calculators',
  'bulk_import',
  'feedback_reviews',
  'live_chat',
  'ai_assistant',
] as const;

/** Slug of an optional pack a tenant can enable. */
export type OptionalPackSlug = (typeof OPTIONAL_PACK_SLUGS)[number];

/** Every pack slug including the implicit, always-on `core`. */
export const ALL_PACK_SLUGS = ['core', ...OPTIONAL_PACK_SLUGS] as const;

/** Any pack slug, including the implicit `core`. */
export type PackSlug = (typeof ALL_PACK_SLUGS)[number];
