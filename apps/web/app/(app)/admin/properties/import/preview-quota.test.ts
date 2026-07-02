import { beforeEach, describe, expect, it, vi } from 'vitest';

// EPIC-X FR-X-10 (dry-run surface) — the preview shows the tenant's active-listing
// quota outcome BEFORE they commit, so an over-quota upload is caught up front:
// the plan cap, the current active (published) count, how many rows the upload
// would add, whether that would exceed the cap, and the remaining capacity. The
// preview reads this through an injected seam (getTenantActiveListingQuota + a
// tenant-scoped active count); it performs NO insert, NO import_logs write and NO
// audit — surfacing quota is a read, not a state change (G4 unaffected).

const requireStaffPermission = vi.fn();
vi.mock('../../../lib/staff-session.js', () => ({
  requireStaffPermission: (...a: unknown[]) => requireStaffPermission(...a),
  getStaffActor: vi.fn(),
  getStaffUserId: vi.fn(),
}));

const getCurrentTenantId = vi.fn();
const getRequestIp = vi.fn();
vi.mock('../../../lib/tenant.js', () => ({
  getCurrentTenantId: () => getCurrentTenantId(),
  getRequestIp: () => getRequestIp(),
}));
vi.mock('../../../lib/db.js', () => ({ getDb: () => ({}) }));

// The quota read seam: resolves the tenant's active-listing cap AND their current
// active count. Stubbed so the preview quota block is exercised without a DB.
const readActiveListingUsage = vi.fn();
vi.mock('../../../lib/import-quota.js', () => ({
  readActiveListingUsage: (...a: unknown[]) => readActiveListingUsage(...a),
}));

const insertPropertyRow = vi.fn();
vi.mock('../actions.js', () => ({
  insertPropertyRow: (...a: unknown[]) => insertPropertyRow(...a),
}));

const audit = vi.fn();
const withTenant = vi.fn();
vi.mock('@estate/db', () => ({ withTenant, audit }));

const { previewPropertyImport } = await import('./preview-action.js');

const TENANT = '00000000-0000-0000-0000-000000000001';
const HEADER = 'reference,listingType,saleType,displayAddress,postcode,title,town';

function manyRows(count: number): string {
  const rows: string[] = [HEADER];
  for (let i = 0; i < count; i += 1) {
    rows.push(`REF-${i},residential,sale,${i} Acacia Ave,M21 9WN,Flat ${i},Chorlton`);
  }
  return `${rows.join('\n')}\n`;
}

function csvForm(csvText: string, name = 'catalogue.csv', type = 'text/csv'): FormData {
  const file = new File([csvText], name, { type });
  Object.defineProperty(file, 'text', { value: async () => csvText });
  const fd = new FormData();
  fd.set('file', file);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireStaffPermission.mockResolvedValue(undefined);
  getCurrentTenantId.mockResolvedValue(TENANT);
  getRequestIp.mockResolvedValue('203.0.113.7');
  readActiveListingUsage.mockResolvedValue({ limit: 100, existingActive: 80 });
});

describe('previewPropertyImport — quota info (FR-X-10)', () => {
  it('surfaces remaining capacity for an import that fits within quota', async () => {
    readActiveListingUsage.mockResolvedValue({ limit: 100, existingActive: 80 });
    const res = await previewPropertyImport({ ok: false }, csvForm(manyRows(20)));
    expect(res.ok).toBe(true);
    expect(res.preview!.quota).toMatchObject({
      limit: 100,
      existingActive: 80,
      incoming: 20,
      wouldExceed: false,
      remainingAfterImport: 0,
    });
  });

  it('flags an import that would exceed the quota', async () => {
    readActiveListingUsage.mockResolvedValue({ limit: 100, existingActive: 80 });
    const res = await previewPropertyImport({ ok: false }, csvForm(manyRows(25)));
    expect(res.ok).toBe(true);
    expect(res.preview!.quota).toMatchObject({
      limit: 100,
      existingActive: 80,
      incoming: 25,
      wouldExceed: true,
    });
    // Over-quota remaining capacity never goes negative.
    expect(res.preview!.quota!.remainingAfterImport).toBe(0);
  });

  it('reports an unlimited (enterprise) quota as never exceeding', async () => {
    readActiveListingUsage.mockResolvedValue({ limit: Infinity, existingActive: 100_000 });
    const res = await previewPropertyImport({ ok: false }, csvForm(manyRows(50)));
    expect(res.ok).toBe(true);
    expect(res.preview!.quota!.wouldExceed).toBe(false);
  });

  it('never inserts, writes an import log, or audits during a quota preview', async () => {
    await previewPropertyImport({ ok: false }, csvForm(manyRows(5)));
    expect(insertPropertyRow).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });
});
