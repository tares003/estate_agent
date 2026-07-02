import { getActiveListingQuota, resolvePlanTier, type PlanTier } from '@estate/entitlement';
import { withTenant } from '@estate/db';

import { getDb } from './db.js';
import { getCurrentTenantId } from './tenant.js';

// EPIC-X FR-X-10 — the app-side active-listing quota read model. A bulk import may
// not push a tenant past their plan tier's active-listing cap (PRODUCT.md §5b:
// starter=100, professional=500, enterprise=unlimited).
//
// Two facts drive the check: the tenant's CAP (resolved from their plan tier on the
// operator-owned `platform_tenants` registry, read on the base client by id — that
// table is NOT under RLS per CLAUDE.md §9, exactly like getTenantName), and their
// current ACTIVE count (published, non-deleted listings — a tenant-scoped read that
// runs inside `withTenant`/RLS). The pure helpers below take injected readers so
// they unit-test DB-free; the live wrappers wire the real clients.

/** Structural reader for the tenant's stored plan tier (base client, un-RLS'd). */
export interface TenantPlanTierReader {
  platformTenant: {
    findUnique(args: {
      where: { id: string };
      select?: { planTier: true };
    }): Promise<{ planTier: unknown } | null>;
  };
}

/** Structural reader for the tenant's active (published) listing count (RLS-scoped). */
export interface ActiveListingCounter {
  count(args: { where?: Record<string, unknown> }): Promise<number>;
}

/** The `where` that selects a tenant's ACTIVE listings — published and not soft-deleted. */
export function activeListingWhere(): Record<string, unknown> {
  return { publicationStatus: 'published', deletedAt: null };
}

/** The tenant's active-listing usage: their cap and their current active count. */
export interface ActiveListingUsage {
  /** The plan-tier active-listing cap (Infinity for enterprise). */
  limit: number;
  /** The tenant's current active (published) listing count. */
  existingActive: number;
}

/**
 * Resolve a tenant's plan tier from the operator registry, defaulting to the
 * strictest tier (`starter`) when the tenant row or tier is absent — so quota
 * enforcement fails closed rather than granting an unbounded cap by omission.
 */
export async function resolveTenantPlanTier(
  reader: TenantPlanTierReader,
  tenantId: string,
): Promise<PlanTier> {
  const row = await reader.platformTenant.findUnique({
    where: { id: tenantId },
    select: { planTier: true },
  });
  return resolvePlanTier(row?.planTier);
}

/**
 * The tenant's active-listing cap AND their current active count — the two inputs
 * the quota decision needs. Pure over injected readers.
 */
export async function computeActiveListingUsage(
  tenantReader: TenantPlanTierReader,
  activeCounter: ActiveListingCounter,
  tenantId: string,
): Promise<ActiveListingUsage> {
  const tier = await resolveTenantPlanTier(tenantReader, tenantId);
  const existingActive = await activeCounter.count({ where: activeListingWhere() });
  return { limit: getActiveListingQuota(tier), existingActive };
}

/**
 * The current request tenant's active-listing cap (Infinity for enterprise). Reads
 * the plan tier from the un-RLS'd registry on the base client. The import action
 * uses this and counts existing active listings inside its own tenant transaction.
 */
export async function getTenantActiveListingQuota(): Promise<number> {
  const tenantId = await getCurrentTenantId();
  const tier = await resolveTenantPlanTier(getDb() as unknown as TenantPlanTierReader, tenantId);
  return getActiveListingQuota(tier);
}

/**
 * The current request tenant's active-listing usage (cap + current active count),
 * for the dry-run preview. The cap is read on the base client (registry, un-RLS'd);
 * the active count runs tenant-scoped inside `withTenant`. A read only — no write,
 * no audit.
 */
export async function readActiveListingUsage(): Promise<ActiveListingUsage> {
  const tenantId = await getCurrentTenantId();
  const tier = await resolveTenantPlanTier(getDb() as unknown as TenantPlanTierReader, tenantId);
  const existingActive = await withTenant(getDb(), tenantId, (tx) =>
    (tx as unknown as ActiveListingCounter).count({ where: activeListingWhere() }),
  );
  return { limit: getActiveListingQuota(tier), existingActive };
}
