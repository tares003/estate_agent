// pack: core
/**
 * Plan-tier active-listing quotas (EPIC-X FR-X-10 / PRODUCT.md §5b + "Tier
 * inclusions and metering").
 *
 * A tenant's plan tier sets the base quota for active (published) property
 * listings. A bulk import may not push a tenant past this cap. These helpers are
 * pure and DB-free: the tier -> cap map, and a defensive normaliser that resolves
 * an arbitrary value to a known tier.
 *
 * This is core metering infrastructure (every tenant has a tier, regardless of
 * which optional packs are enabled), so it carries the `// pack: core` marker for
 * CI guard G12 rather than being gated behind a pack.
 */

/** The three plan-tier codes, ascending (PRODUCT.md §5b). */
export const PLAN_TIERS = ['starter', 'professional', 'enterprise'] as const;

/** A tenant's plan tier. */
export type PlanTier = (typeof PLAN_TIERS)[number];

/**
 * Active (published) property-listing cap per plan tier (PRODUCT.md "Tier
 * inclusions and metering"). Enterprise is unlimited, modelled as `Infinity` so
 * arithmetic comparisons never trip.
 */
export const ACTIVE_LISTING_QUOTA: Readonly<Record<PlanTier, number>> = {
  starter: 100,
  professional: 500,
  enterprise: Infinity,
};

/** The active-listing quota for a plan tier. */
export function getActiveListingQuota(planTier: PlanTier): number {
  return ACTIVE_LISTING_QUOTA[planTier];
}

/**
 * Normalise an arbitrary value to a known plan tier. An unknown, missing or
 * malformed value resolves to the STRICTEST tier (`starter`) so quota enforcement
 * fails closed when a tenant's tier cannot be determined.
 */
export function resolvePlanTier(value: unknown): PlanTier {
  if (typeof value !== 'string') return 'starter';
  const normalised = value.trim().toLowerCase();
  return (PLAN_TIERS as readonly string[]).includes(normalised)
    ? (normalised as PlanTier)
    : 'starter';
}
