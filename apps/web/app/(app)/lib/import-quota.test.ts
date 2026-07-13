import { beforeEach, describe, expect, it, vi } from 'vitest';

// EPIC-X FR-X-10 — the app-side quota read model. Resolves the current tenant's
// active-listing cap from their plan tier (via @estate/entitlement) and counts
// their existing ACTIVE listings. "Active" means publicly LIVE — the SAME
// predicate the public catalogue and the publish actions use (publishedAt set,
// not soft-deleted), NOT the publicationStatus column (which the publish flow
// never writes; audit finding import-quota-active-predicate-diverges-from-publish).
// Pure over injected readers so it is DB-free to unit-test; the live wiring
// (tenant id + tenant-scoped count) is thin.

const getCurrentTenantId = vi.fn();
vi.mock('./tenant.js', () => ({
  getCurrentTenantId: () => getCurrentTenantId(),
}));
vi.mock('./db.js', () => ({ getDb: () => ({}) }));

const withTenant = vi.fn();
vi.mock('@estate/db', () => ({ withTenant }));

const { resolveTenantPlanTier, computeActiveListingUsage, activeListingWhere } = await import(
  './import-quota.js'
);

const TENANT = '00000000-0000-0000-0000-000000000001';

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentTenantId.mockResolvedValue(TENANT);
});

describe('resolveTenantPlanTier', () => {
  it('reads the plan tier from the platform_tenants registry', async () => {
    const reader = {
      platformTenant: {
        findUnique: vi.fn().mockResolvedValue({ planTier: 'professional' }),
      },
    };
    expect(await resolveTenantPlanTier(reader, TENANT)).toBe('professional');
  });

  it('defaults to starter (strictest) when the tenant has no stored tier', async () => {
    const reader = {
      platformTenant: { findUnique: vi.fn().mockResolvedValue({ planTier: null }) },
    };
    expect(await resolveTenantPlanTier(reader, TENANT)).toBe('starter');
  });

  it('defaults to starter for an unknown tenant', async () => {
    const reader = {
      platformTenant: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    expect(await resolveTenantPlanTier(reader, TENANT)).toBe('starter');
  });
});

describe('activeListingWhere', () => {
  it('selects listings by the SAME predicate that makes them publicly live', () => {
    // The public catalogue (lib/properties.ts buildWhere) and the publish actions key
    // solely off publishedAt — publicationStatus is never written by the publish flow,
    // so counting it would let a tenant publish past the cap unbounded.
    expect(activeListingWhere()).toEqual({ publishedAt: { not: null }, deletedAt: null });
    expect(activeListingWhere()).not.toHaveProperty('publicationStatus');
  });
});

describe('computeActiveListingUsage', () => {
  it('maps the resolved tier to a cap and counts LIVE (publishedAt set) listings', async () => {
    const tenantReader = {
      platformTenant: {
        findUnique: vi.fn().mockResolvedValue({ planTier: 'professional' }),
      },
    };
    const activeCount = vi.fn().mockResolvedValue(42);
    const usage = await computeActiveListingUsage(tenantReader, { count: activeCount }, TENANT);
    expect(usage).toEqual({ limit: 500, existingActive: 42 });
    // Only publicly live listings count toward the quota — same predicate as the
    // public catalogue, not the publicationStatus column the publish flow never sets.
    const where = (activeCount.mock.calls[0]![0] as { where?: Record<string, unknown> }).where;
    expect(where).toEqual({ publishedAt: { not: null }, deletedAt: null });
  });

  it('gives a starter tenant a cap of 100', async () => {
    const tenantReader = {
      platformTenant: { findUnique: vi.fn().mockResolvedValue({ planTier: 'starter' }) },
    };
    const usage = await computeActiveListingUsage(
      tenantReader,
      { count: vi.fn().mockResolvedValue(0) },
      TENANT,
    );
    expect(usage.limit).toBe(100);
  });
});
