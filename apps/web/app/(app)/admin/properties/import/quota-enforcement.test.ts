import { beforeEach, describe, expect, it, vi } from 'vitest';

// EPIC-X FR-X-10 — a bulk import may not push a tenant past their plan tier's
// active-listing quota (PRODUCT.md §5b metering: starter=100, professional=500,
// enterprise=unlimited). The import action, AFTER the fail-closed RBAC gate and
// BEFORE any property insert, resolves the tenant's quota, counts existing ACTIVE
// listings by the SAME predicate that makes a listing publicly live (publishedAt
// set, not soft-deleted — never publicationStatus, which the publish flow never
// writes), and adds the incoming rows the file imports as published. Draft rows do
// not consume the ACTIVE cap, so a draft-only import is never blocked by it. If
// existing + incoming exceeds the quota the run is aborted with a clear "Quota
// would be exceeded" error — nothing is created, no import_logs row is written,
// and no property is audited. Because the abort happens before the tenant
// transaction there is no state change to audit (G4 unaffected). When the import
// fits, the quota decision is recorded on the property.imported run audit diff.
//
// This test mocks the staff-session, tenant and db seams exactly like actions.test.ts,
// and additionally stubs the quota resolution so it can drive both the pass and the
// fail branch deterministically without a real plan-tier column.

const requireStaffPermission = vi.fn();
const getStaffActor = vi.fn();
const getStaffUserId = vi.fn();
vi.mock('../../../lib/staff-session.js', () => ({
  requireStaffPermission: (...a: unknown[]) => requireStaffPermission(...a),
  getStaffActor: () => getStaffActor(),
  getStaffUserId: () => getStaffUserId(),
}));

const getCurrentTenantId = vi.fn();
const getRequestIp = vi.fn();
const getRequestUserAgent = vi.fn();
vi.mock('../../../lib/tenant.js', () => ({
  getCurrentTenantId: () => getCurrentTenantId(),
  getRequestIp: () => getRequestIp(),
  getRequestUserAgent: () => getRequestUserAgent(),
}));
vi.mock('../../../lib/db.js', () => ({ getDb: () => ({}) }));

// The G12 pack gate on the import path — permissive by default so quota behaviour
// is exercised alone; the deny branch is covered in actions.test.ts.
const isListingTypePermitted = vi.fn();
vi.mock('../../../lib/packs.js', () => ({
  isListingTypePermitted: (...a: unknown[]) => isListingTypePermitted(...a),
}));

// The active-listing quota the import must respect for the current tenant. Stubbed
// so the test can put the tenant on any tier without a real plan-tier source. The
// real `activeListingWhere` is kept so the count `where` is asserted end-to-end.
const getTenantActiveListingQuota = vi.fn();
vi.mock('../../../lib/import-quota.js', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/import-quota.js')>(
    '../../../lib/import-quota.js',
  );
  return {
    ...actual,
    getTenantActiveListingQuota: (...a: unknown[]) => getTenantActiveListingQuota(...a),
  };
});

const insertPropertyRow = vi.fn(
  async (_tx: unknown, _ctx: unknown, input: { reference: string }, taken: Set<string>) => {
    const slug = `slug-${input.reference}`;
    taken.add(slug);
    return { id: `id-${input.reference}`, slug };
  },
);
const updatePropertyRow = vi.fn();
vi.mock('../property-insert.js', () => ({
  insertPropertyRow: (...a: unknown[]) =>
    insertPropertyRow(...(a as [unknown, unknown, { reference: string }, Set<string>])),
  updatePropertyRow: (...a: unknown[]) => updatePropertyRow(...(a as [])),
}));

const audit = vi.fn();
const propertyFindMany = vi.fn();
const propertyCount = vi.fn();
const importLogCreate = vi.fn();
const executeRawUnsafe = vi.fn();
const withTenant = vi.fn(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
  fn({
    property: { findMany: propertyFindMany, count: propertyCount },
    importLog: { create: importLogCreate },
    $executeRawUnsafe: executeRawUnsafe,
  }),
);
vi.mock('@estate/db', () => ({ withTenant, audit }));

const { importPropertiesFromCsv } = await import('./actions.js');

const TENANT = '00000000-0000-0000-0000-000000000001';
const USER_ID = '22222222-2222-2222-2222-222222222222';
const LOG_ID = '33333333-3333-3333-3333-333333333333';

const HEADER =
  'reference,listingType,saleType,displayAddress,postcode,title,town,publicationStatus';

/**
 * Build a HEADER + N synthetic valid data rows, each imported with the given
 * publicationStatus — 'published' rows consume the ACTIVE cap, 'draft' rows do not.
 */
function manyRows(count: number, publicationStatus: 'published' | 'draft' = 'published'): string {
  const rows: string[] = [HEADER];
  for (let i = 0; i < count; i += 1) {
    rows.push(
      `REF-${i},residential,sale,${i} Acacia Ave,M21 9WN,Flat ${i},Chorlton,${publicationStatus}`,
    );
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
  getStaffActor.mockResolvedValue('agent:albert-aardvark');
  getStaffUserId.mockResolvedValue(USER_ID);
  getCurrentTenantId.mockResolvedValue(TENANT);
  getRequestIp.mockResolvedValue('203.0.113.7');
  getRequestUserAgent.mockResolvedValue('Mozilla/5.0 (Test)');
  propertyFindMany.mockResolvedValue([]);
  propertyCount.mockResolvedValue(0);
  importLogCreate.mockResolvedValue({ id: LOG_ID });
  isListingTypePermitted.mockResolvedValue(true);
  // Default: a generous quota so unrelated behaviour is unaffected.
  getTenantActiveListingQuota.mockResolvedValue(Infinity);
});

describe('importPropertiesFromCsv — plan-quota enforcement (FR-X-10)', () => {
  it('never reaches the quota check when RBAC fails (fail-closed)', async () => {
    requireStaffPermission.mockRejectedValue(new Error('forbidden'));
    const res = await importPropertiesFromCsv({ ok: false }, csvForm(manyRows(1)));
    expect(res.ok).toBe(false);
    expect(getTenantActiveListingQuota).not.toHaveBeenCalled();
    expect(insertPropertyRow).not.toHaveBeenCalled();
    expect(importLogCreate).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('imports when existing + incoming is within quota', async () => {
    getTenantActiveListingQuota.mockResolvedValue(100);
    propertyCount.mockResolvedValue(80); // 80 existing + 20 incoming = 100 (== quota, allowed)
    const res = await importPropertiesFromCsv({ ok: false }, csvForm(manyRows(20)));
    expect(res.ok).toBe(true);
    expect(insertPropertyRow).toHaveBeenCalledTimes(20);
    expect(res.counts).toMatchObject({ created: 20 });
  });

  it('aborts before any insert when existing + incoming exceeds quota', async () => {
    getTenantActiveListingQuota.mockResolvedValue(100);
    propertyCount.mockResolvedValue(80); // 80 existing + 21 incoming = 101 > 100
    const res = await importPropertiesFromCsv({ ok: false }, csvForm(manyRows(21)));
    expect(res.ok).toBe(false);
    expect(res.errors?.[0]?.message ?? '').toMatch(/quota/i);
    // Nothing is created, no import log is written, nothing is audited.
    expect(insertPropertyRow).not.toHaveBeenCalled();
    expect(importLogCreate).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('fails the boundary case: existing == quota, one more row would exceed', async () => {
    getTenantActiveListingQuota.mockResolvedValue(100);
    propertyCount.mockResolvedValue(100); // already at cap; 1 incoming = 101 > 100
    const res = await importPropertiesFromCsv({ ok: false }, csvForm(manyRows(1)));
    expect(res.ok).toBe(false);
    expect(res.errors?.[0]?.message ?? '').toMatch(/quota/i);
    expect(insertPropertyRow).not.toHaveBeenCalled();
  });

  it('counts existing active listings by the LIVE predicate (publishedAt set, not deleted)', async () => {
    getTenantActiveListingQuota.mockResolvedValue(500);
    propertyCount.mockResolvedValue(10);
    await importPropertiesFromCsv({ ok: false }, csvForm(manyRows(1)));
    expect(propertyCount).toHaveBeenCalledTimes(1);
    // The SAME predicate that makes a listing publicly live (lib/properties.ts
    // buildWhere / the publish actions) — NOT publicationStatus, which the publish
    // flow never writes, so counting it lets a tenant publish past the cap unbounded.
    const where = (propertyCount.mock.calls[0]![0] as { where?: Record<string, unknown> }).where;
    expect(where).toEqual({ publishedAt: { not: null }, deletedAt: null });
  });

  it('does not block a draft-only import at the ACTIVE cap (drafts are not active)', async () => {
    getTenantActiveListingQuota.mockResolvedValue(100);
    propertyCount.mockResolvedValue(100); // at the cap — but draft rows add no ACTIVE listing
    const res = await importPropertiesFromCsv({ ok: false }, csvForm(manyRows(5, 'draft')));
    expect(res.ok).toBe(true);
    expect(insertPropertyRow).toHaveBeenCalledTimes(5);
    expect(res.counts).toMatchObject({ created: 5 });
  });

  it('counts only rows imported as published toward the incoming total', async () => {
    getTenantActiveListingQuota.mockResolvedValue(100);
    propertyCount.mockResolvedValue(98);
    // 3 published + 4 draft incoming: 98 + 3 = 101 > 100 — the published rows alone
    // breach the cap, so the run aborts; the draft rows never rescue it.
    const published = manyRows(3, 'published').trimEnd().split('\n').slice(1);
    const drafts = [];
    for (let i = 0; i < 4; i += 1) {
      drafts.push(`REF-D${i},residential,sale,${i} Beech Rd,M21 9WN,Draft ${i},Chorlton,draft`);
    }
    const res = await importPropertiesFromCsv(
      { ok: false },
      csvForm(`${[HEADER, ...published, ...drafts].join('\n')}\n`),
    );
    expect(res.ok).toBe(false);
    expect(res.errors?.[0]?.message ?? '').toMatch(/quota/i);
    expect(insertPropertyRow).not.toHaveBeenCalled();
  });

  it('never lets an enterprise (unlimited) tenant hit a quota abort', async () => {
    getTenantActiveListingQuota.mockResolvedValue(Infinity);
    propertyCount.mockResolvedValue(100_000);
    const res = await importPropertiesFromCsv({ ok: false }, csvForm(manyRows(5)));
    expect(res.ok).toBe(true);
    expect(insertPropertyRow).toHaveBeenCalledTimes(5);
  });

  it('records the quota decision on the property.imported run audit diff', async () => {
    getTenantActiveListingQuota.mockResolvedValue(100);
    propertyCount.mockResolvedValue(80);
    await importPropertiesFromCsv({ ok: false }, csvForm(manyRows(10)));
    const runAudit = audit.mock.calls.find(
      (call) => (call[1] as { action: string }).action === 'property.imported',
    );
    expect(runAudit).toBeDefined();
    const diff = (runAudit![1] as { diff: Record<string, unknown> }).diff;
    expect(diff).toMatchObject({
      quota: { limit: 100, existingActive: 80, incoming: 10 },
    });
  });
});
