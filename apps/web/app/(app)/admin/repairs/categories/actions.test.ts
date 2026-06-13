import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCurrentTenantId = vi.fn();
const getRequestIp = vi.fn();
vi.mock('../../../lib/tenant.js', () => ({
  getCurrentTenantId: () => getCurrentTenantId(),
  getRequestIp: () => getRequestIp(),
}));
vi.mock('../../../lib/db.js', () => ({ getDb: () => ({}) }));

const requireStaffPermission = vi.fn();
const getStaffActor = vi.fn();
vi.mock('../../../lib/staff-session.js', () => ({
  requireStaffPermission: (...args: unknown[]) => requireStaffPermission(...args),
  getStaffActor: () => getStaffActor(),
}));

const audit = vi.fn();
const count = vi.fn();
const createMany = vi.fn();
const findFirst = vi.fn();
const update = vi.fn();
const withTenant = vi.fn(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
  fn({ repairCategory: { count, createMany, findFirst, update } }),
);
vi.mock('@estate/db', () => ({ withTenant, audit }));

const { seedRepairCategories, setRepairCategoryVisibility } = await import('./actions.js');

const TENANT = '00000000-0000-0000-0000-000000000001';

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentTenantId.mockResolvedValue(TENANT);
  getRequestIp.mockResolvedValue('203.0.113.7');
  requireStaffPermission.mockResolvedValue(undefined);
  getStaffActor.mockResolvedValue('user:staff-1');
  count.mockResolvedValue(0);
  createMany.mockResolvedValue({ count: 18 });
  findFirst.mockResolvedValue({ id: 'c1', slug: 'plumbing', label: 'Plumbing', visible: true });
  update.mockResolvedValue({});
});

describe('seedRepairCategories', () => {
  it('inserts the 18 §G.3 defaults when the catalogue is empty and audits (G4)', async () => {
    const result = await seedRepairCategories({ ok: false }, form({}));

    expect(result.ok).toBe(true);
    expect(requireStaffPermission).toHaveBeenCalledWith('repair_request.manage');
    const created = createMany.mock.calls[0]?.[0]?.data as Array<{
      slug: string;
      sortOrder: number;
    }>;
    expect(created).toHaveLength(18);
    expect(created[0]).toMatchObject({ tenantId: TENANT, slug: 'plumbing', sortOrder: 0 });
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'repair_category.seeded', entity: 'repair_category' }),
    );
  });

  it('is a no-op when the catalogue already has categories (no insert)', async () => {
    count.mockResolvedValue(3);
    const result = await seedRepairCategories({ ok: false }, form({}));
    expect(result.ok).toBe(false);
    expect(createMany).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('fails closed when RBAC denies, before any read or write', async () => {
    requireStaffPermission.mockRejectedValue(new Error('denied'));
    const result = await seedRepairCategories({ ok: false }, form({}));
    expect(result.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
  });
});

describe('setRepairCategoryVisibility', () => {
  it('updates the category visibility and audits the change (G4)', async () => {
    const result = await setRepairCategoryVisibility(
      { ok: false },
      form({ slug: 'plumbing', visible: 'false' }),
    );

    expect(result.ok).toBe(true);
    expect(requireStaffPermission).toHaveBeenCalledWith('repair_request.manage');
    expect(findFirst).toHaveBeenCalledWith({ where: { slug: 'plumbing' } });
    expect(update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { visible: false } });
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'repair_category.visibility_changed',
        entity: 'repair_category',
        entityId: 'c1',
        diff: { visible: { from: true, to: false } },
      }),
    );
  });

  it('rejects an invalid visibility value before any write', async () => {
    const result = await setRepairCategoryVisibility(
      { ok: false },
      form({ slug: 'plumbing', visible: 'maybe' }),
    );
    expect(result.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('refuses an unknown category without writing', async () => {
    findFirst.mockResolvedValue(null);
    const result = await setRepairCategoryVisibility(
      { ok: false },
      form({ slug: 'nope', visible: 'true' }),
    );
    expect(result.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it('fails closed when RBAC denies, before any read or write', async () => {
    requireStaffPermission.mockRejectedValue(new Error('denied'));
    const result = await setRepairCategoryVisibility(
      { ok: false },
      form({ slug: 'plumbing', visible: 'false' }),
    );
    expect(result.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
  });
});
