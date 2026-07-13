import { beforeEach, describe, expect, it, vi } from 'vitest';

// EPIC-AD / G12 — the app-side pack-entitlement resolution for the FR-F-3 vertical
// listing types. `isListingTypePermitted` is the SERVER-SIDE gate the property write
// actions (and the bulk import) consult before authoring a vertical: core listing
// types are always permitted; a pack-gated vertical is permitted only when the
// tenant's registry row lists its pack. The pack decision flows through the
// canonical `isPackEnabled` (real, from @estate/entitlement); only the registry
// read (PrismaPackSource) and the request seams are mocked.

const getCurrentTenantId = vi.fn();
vi.mock('./tenant.js', () => ({ getCurrentTenantId: () => getCurrentTenantId() }));
vi.mock('./db.js', () => ({ getDb: () => ({}) }));

const getEnabledPacks = vi.fn();
vi.mock('@estate/db', () => ({
  PrismaPackSource: class {
    getEnabledPacks(...a: unknown[]) {
      return getEnabledPacks(...a);
    }
  },
}));

const { isListingTypePermitted, getEnabledVerticals } = await import('./packs.js');

const TENANT = '00000000-0000-0000-0000-000000000001';

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentTenantId.mockResolvedValue(TENANT);
  getEnabledPacks.mockResolvedValue([]);
});

describe('isListingTypePermitted', () => {
  it('always permits the core listing types (no pack required)', async () => {
    expect(await isListingTypePermitted('residential')).toBe(true);
    expect(await isListingTypePermitted('land')).toBe(true);
    // No registry read is needed to answer for a core type.
    expect(getEnabledPacks).not.toHaveBeenCalled();
  });

  it('permits a pack-gated vertical when the tenant has its pack', async () => {
    getEnabledPacks.mockResolvedValue(['care_homes']);
    expect(await isListingTypePermitted('care_home')).toBe(true);
    expect(getEnabledPacks).toHaveBeenCalledWith(TENANT);
  });

  it('denies a pack-gated vertical when the tenant lacks its pack (fail closed)', async () => {
    getEnabledPacks.mockResolvedValue(['new_homes']);
    expect(await isListingTypePermitted('commercial')).toBe(false);
    expect(await isListingTypePermitted('business_transfer')).toBe(false);
    expect(await isListingTypePermitted('care_home')).toBe(false);
  });
});

describe('getEnabledVerticals', () => {
  it('maps the enabled packs onto their authorable vertical listing types', async () => {
    getEnabledPacks.mockResolvedValue(['new_homes', 'commercial']);
    expect(await getEnabledVerticals()).toEqual(['new_home', 'commercial']);
  });

  it('yields no verticals for a tenant with no optional packs', async () => {
    getEnabledPacks.mockResolvedValue([]);
    expect(await getEnabledVerticals()).toEqual([]);
  });
});
