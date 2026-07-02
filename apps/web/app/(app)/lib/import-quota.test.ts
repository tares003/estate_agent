import { beforeEach, describe, expect, it, vi } from 'vitest';

// EPIC-X FR-X-10 — the app-side quota read model. Resolves the current tenant's
// active-listing cap from their plan tier (via @estate/entitlement) and counts
// their existing PUBLISHED (active) listings. Pure over injected readers so it is
// DB-free to unit-test; the live wiring (tenant id + tenant-scoped count) is thin.

const getCurrentTenantId = vi.fn();
vi.mock('./tenant.js', () => ({
  getCurrentTenantId: () => getCurrentTenantId(),
}));
vi.mock('./db.js', () => ({ getDb: () => ({}) }));

const withTenant = vi.fn();
vi.mock('@estate/db', () => ({ withTenant }));

const { resolveTenantPlanTier, computeActiveListingUsage } = await import('./import-quota.js');

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

describe('computeActiveListingUsage', () => {
  it('maps the resolved tier to a cap and counts published listings', async () => {
    const tenantReader = {
      platformTenant: {
        findUnique: vi.fn().mockResolvedValue({ planTier: 'professional' }),
      },
    };
    const activeCount = vi.fn().mockResolvedValue(42);
    const usage = await computeActiveListingUsage(tenantReader, { count: activeCount }, TENANT);
    expect(usage).toEqual({ limit: 500, existingActive: 42 });
    // Only published (active) listings count toward the quota.
    const where = (activeCount.mock.calls[0]![0] as { where?: Record<string, unknown> }).where;
    expect(where).toMatchObject({ publicationStatus: 'published' });
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
