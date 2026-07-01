import { beforeEach, describe, expect, it, vi } from 'vitest';

// EPIC-X FR-X-1 / FR-X-6 / FR-X-9 — the audited bulk CSV import action. Mirrors the
// property create/import action tests: mock the staff-session, tenant and db seams +
// the shared insertPropertyRow. Assert fail-closed RBAC, that valid rows are created
// through the shared insert path, that ONE import_logs row captures the counts +
// per-row error summary, and that the run is audited (property.imported) in the same
// transaction (G4) — while a bad row is isolated and the rest still import (FR-X-5).

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
vi.mock('../../../lib/tenant.js', () => ({
  getCurrentTenantId: () => getCurrentTenantId(),
  getRequestIp: () => getRequestIp(),
}));
vi.mock('../../../lib/db.js', () => ({ getDb: () => ({}) }));

// The shared insert path — spied so this test exercises the import orchestration, not
// the (separately-tested) property insert. It reserves the minted slug like the real one.
const insertPropertyRow = vi.fn(
  async (_tx: unknown, _ctx: unknown, input: { reference: string }, taken: Set<string>) => {
    const slug = `slug-${input.reference}`;
    taken.add(slug);
    return { id: `id-${input.reference}`, slug };
  },
);
vi.mock('../actions.js', () => ({
  insertPropertyRow: (...a: unknown[]) =>
    insertPropertyRow(...(a as [unknown, unknown, { reference: string }, Set<string>])),
}));

const audit = vi.fn();
const propertyFindMany = vi.fn();
const importLogCreate = vi.fn();
const withTenant = vi.fn(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
  fn({
    property: { findMany: propertyFindMany },
    importLog: { create: importLogCreate },
  }),
);
vi.mock('@estate/db', () => ({ withTenant, audit }));

const { importPropertiesFromCsv } = await import('./actions.js');

const TENANT = '00000000-0000-0000-0000-000000000001';
const USER_ID = '22222222-2222-2222-2222-222222222222';
const LOG_ID = '33333333-3333-3333-3333-333333333333';

const HEADER = 'reference,listingType,saleType,displayAddress,postcode,title,town';
const GOOD_1 = 'REF-001,residential,sale,12 Acacia Ave,M21 9WN,Flat One,Chorlton';
const GOOD_2 = 'REF-002,residential,sale,14 Acacia Ave,M21 9WN,Flat Two,Chorlton';
const BAD_MISSING_POSTCODE = 'REF-003,residential,sale,16 Acacia Ave,,Flat Three,Chorlton';

/**
 * A FormData carrying a CSV file with the given text. jsdom's `File` does not
 * implement `.text()`, so we attach a working one — the action reads the upload via
 * `file.text()`, and `instanceof File` must still hold for the type/size checks.
 */
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
  propertyFindMany.mockResolvedValue([]);
  importLogCreate.mockResolvedValue({ id: LOG_ID });
});

describe('importPropertiesFromCsv', () => {
  it('denies when the staff role lacks property.write (fail-closed) — nothing written', async () => {
    requireStaffPermission.mockRejectedValue(new Error('forbidden'));
    const res = await importPropertiesFromCsv({ ok: false }, csvForm(`${HEADER}\n${GOOD_1}\n`));
    expect(res.ok).toBe(false);
    expect(insertPropertyRow).not.toHaveBeenCalled();
    expect(importLogCreate).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('rejects a submission with no file before any write', async () => {
    const res = await importPropertiesFromCsv({ ok: false }, new FormData());
    expect(res.ok).toBe(false);
    expect(importLogCreate).not.toHaveBeenCalled();
  });

  it('rejects a non-CSV file', async () => {
    const res = await importPropertiesFromCsv(
      { ok: false },
      csvForm('reference\nX', 'notes.txt', 'text/plain'),
    );
    expect(res.ok).toBe(false);
    expect(insertPropertyRow).not.toHaveBeenCalled();
  });

  it('rejects an empty CSV (parse error) before any write', async () => {
    const res = await importPropertiesFromCsv({ ok: false }, csvForm(`${HEADER}\n`));
    expect(res.ok).toBe(false);
    expect(importLogCreate).not.toHaveBeenCalled();
  });

  it('creates each valid row through the shared insert path', async () => {
    const res = await importPropertiesFromCsv(
      { ok: false },
      csvForm(`${HEADER}\n${GOOD_1}\n${GOOD_2}\n`),
    );
    expect(res.ok).toBe(true);
    expect(insertPropertyRow).toHaveBeenCalledTimes(2);
    expect(res.counts).toMatchObject({ input: 2, created: 2, skipped: 0, failed: 0 });
  });

  it('writes ONE import_logs row with source=csv_upload, triggeredBy and the counts (FR-X-6)', async () => {
    await importPropertiesFromCsv({ ok: false }, csvForm(`${HEADER}\n${GOOD_1}\n`));
    expect(importLogCreate).toHaveBeenCalledTimes(1);
    const data = importLogCreate.mock.calls[0]![0].data as Record<string, unknown>;
    expect(data).toMatchObject({
      tenantId: TENANT,
      source: 'csv_upload',
      triggeredBy: USER_ID,
      recordsInput: 1,
      recordsCreated: 1,
      recordsUpdated: 0,
      recordsSkipped: 0,
      recordsFailed: 0,
    });
    expect(data['startedAt']).toBeInstanceOf(Date);
    expect(data['finishedAt']).toBeInstanceOf(Date);
  });

  it('audits the run as property.imported against the import_log id (FR-X-9)', async () => {
    await importPropertiesFromCsv({ ok: false }, csvForm(`${HEADER}\n${GOOD_1}\n`));
    const runAudit = audit.mock.calls.find(
      (call) => (call[1] as { action: string }).action === 'property.imported',
    );
    expect(runAudit).toBeDefined();
    expect(runAudit![1]).toMatchObject({
      action: 'property.imported',
      entity: 'import_log',
      entityId: LOG_ID,
    });
  });

  it('isolates a row that fails validation, imports the rest, and records the failure (FR-X-5)', async () => {
    const res = await importPropertiesFromCsv(
      { ok: false },
      csvForm(`${HEADER}\n${GOOD_1}\n${BAD_MISSING_POSTCODE}\n`),
    );
    expect(res.ok).toBe(true);
    // Only the valid row is created.
    expect(insertPropertyRow).toHaveBeenCalledTimes(1);
    expect(res.counts).toMatchObject({ input: 2, created: 1, failed: 1 });
    // The failure is summarised for the admin AND stored on the log.
    expect(res.errorSummary).toHaveLength(1);
    expect(res.errorSummary![0]).toContain('Row 2');
    const data = importLogCreate.mock.calls[0]![0].data as { errorSummary: unknown };
    expect(data.errorSummary).toEqual({ rows: res.errorSummary });
  });

  it('seeds slug de-duplication from the tenant existing slugs', async () => {
    propertyFindMany.mockResolvedValue([{ slug: 'existing-one' }]);
    await importPropertiesFromCsv({ ok: false }, csvForm(`${HEADER}\n${GOOD_1}\n`));
    const taken = insertPropertyRow.mock.calls[0]![3] as Set<string>;
    expect(taken.has('existing-one')).toBe(true);
  });

  it('stores a null errorSummary when no rows failed', async () => {
    await importPropertiesFromCsv({ ok: false }, csvForm(`${HEADER}\n${GOOD_1}\n`));
    const data = importLogCreate.mock.calls[0]![0].data as { errorSummary: unknown };
    expect(data.errorSummary).toBeNull();
  });
});
