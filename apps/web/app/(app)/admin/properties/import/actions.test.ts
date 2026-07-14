import { beforeEach, describe, expect, it, vi } from 'vitest';

// EPIC-X FR-X-1 / FR-X-5 / FR-X-6 / FR-X-9 — the audited bulk CSV import action.
// Mirrors the property create/import action tests: mock the staff-session, tenant and
// db seams + the shared insertPropertyRow. Assert fail-closed RBAC, that valid rows
// are created through the shared insert path, that ONE import_logs row captures the
// counts + per-row error summary, and that the run is audited (property.imported) in
// the same transaction (G4) — while a bad row is isolated and the rest still import
// (FR-X-5). Row isolation covers BOTH validation failures AND DB-constraint failures
// (a duplicate reference / P2002 rolls back only its own savepoint, never the run —
// audit finding import-duplicate-reference-aborts-whole-run), and the G12 pack gate
// fails rows whose vertical listing type the tenant has not enabled.

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

// EPIC-AD / G12 — the server-side pack gate for the per-vertical listing types.
// Permissive by default; the deny branch is asserted explicitly below.
const isListingTypePermitted = vi.fn();
vi.mock('../../../lib/packs.js', () => ({
  isListingTypePermitted: (...a: unknown[]) => isListingTypePermitted(...a),
}));

// FR-X-10 — the plan-tier active-listing cap. Default to unlimited here so the
// create/audit behaviour these tests assert is unaffected by quota; the quota
// branch itself is covered in quota-enforcement.test.ts.
const getTenantActiveListingQuota = vi.fn();
vi.mock('../../../lib/import-quota.js', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/import-quota.js')>(
    '../../../lib/import-quota.js',
  );
  return {
    ...actual,
    getTenantActiveListingQuota: () => getTenantActiveListingQuota(),
  };
});

// The shared insert path — spied so this test exercises the import orchestration, not
// the (separately-tested) property insert. It reserves the minted slug like the real one.
// Lives in the non-action property-insert module (never a Server Action export).
const insertPropertyRow = vi.fn(
  async (_tx: unknown, _ctx: unknown, input: { reference: string }, taken: Set<string>) => {
    const slug = `slug-${input.reference}`;
    taken.add(slug);
    return { id: `id-${input.reference}`, slug };
  },
);
vi.mock('../property-insert.js', () => ({
  insertPropertyRow: (...a: unknown[]) =>
    insertPropertyRow(...(a as [unknown, unknown, { reference: string }, Set<string>])),
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

/** A FormData carrying a CSV plus a JSON-stringified column mapping (FR-X-3). */
function csvFormWithMapping(csvText: string, mapping: Record<string, string>): FormData {
  const fd = csvForm(csvText);
  fd.set('mapping', JSON.stringify(mapping));
  return fd;
}

const REAPIT_HEADER = 'Agency Reference,Property Type,Sale/Let,Display Address,Postcode';
const REAPIT_ROW = 'REF-100,residential,sale,12 Acacia Ave,M21 9WN';
const REAPIT_MAP = {
  'Agency Reference': 'reference',
  'Property Type': 'listingType',
  'Sale/Let': 'saleType',
  'Display Address': 'displayAddress',
  Postcode: 'postcode',
};

beforeEach(() => {
  vi.clearAllMocks();
  requireStaffPermission.mockResolvedValue(undefined);
  getStaffActor.mockResolvedValue('agent:albert-aardvark');
  getStaffUserId.mockResolvedValue(USER_ID);
  getCurrentTenantId.mockResolvedValue(TENANT);
  getRequestIp.mockResolvedValue('203.0.113.7');
  propertyFindMany.mockResolvedValue([]);
  propertyCount.mockResolvedValue(0);
  importLogCreate.mockResolvedValue({ id: LOG_ID });
  isListingTypePermitted.mockResolvedValue(true);
  getTenantActiveListingQuota.mockResolvedValue(Infinity);
});

/** A P2002-shaped (unique-constraint) error, as Prisma raises for a duplicate reference. */
function p2002(): Error {
  const error = new Error('Unique constraint failed on the fields: (`tenantId`,`reference`)');
  (error as Error & { code: string }).code = 'P2002';
  return error;
}

describe('importPropertiesFromCsv', () => {
  it('denies when the staff role lacks property.import (fail-closed) — nothing written', async () => {
    requireStaffPermission.mockRejectedValue(new Error('forbidden'));
    const res = await importPropertiesFromCsv({ ok: false }, csvForm(`${HEADER}\n${GOOD_1}\n`));
    expect(res.ok).toBe(false);
    expect(insertPropertyRow).not.toHaveBeenCalled();
    expect(importLogCreate).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('gates on property.import (FR-X-1), not the broader property.write', async () => {
    // Audit finding import-uses-property-write-not-property-import: bulk import
    // is its own RBAC capability, distinct from one-by-one property authoring.
    await importPropertiesFromCsv({ ok: false }, csvForm(`${HEADER}\n${GOOD_1}\n`));
    expect(requireStaffPermission).toHaveBeenCalledWith('property.import');
    expect(requireStaffPermission).not.toHaveBeenCalledWith('property.write');
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
    // FR-X-9 — the failed row is audited individually (one audit entry per failed
    // row), not only the run summary.
    const rowFailAudit = audit.mock.calls.find(
      (call) => (call[1] as { action: string }).action === 'property.import_row_failed',
    );
    expect(rowFailAudit).toBeDefined();
    expect((rowFailAudit![1] as { diff: { rowNumber: number } }).diff.rowNumber).toBe(2);
  });

  it('seeds slug de-duplication from the tenant existing slugs', async () => {
    propertyFindMany.mockResolvedValue([{ slug: 'existing-one' }]);
    await importPropertiesFromCsv({ ok: false }, csvForm(`${HEADER}\n${GOOD_1}\n`));
    const taken = insertPropertyRow.mock.calls[0]![3] as Set<string>;
    expect(taken.has('existing-one')).toBe(true);
  });

  it('applies a preset mapping so a CRM export creates properties with mapped fields (FR-X-3)', async () => {
    const res = await importPropertiesFromCsv(
      { ok: false },
      csvFormWithMapping(`${REAPIT_HEADER}\n${REAPIT_ROW}\n`, REAPIT_MAP),
    );
    expect(res.ok).toBe(true);
    expect(insertPropertyRow).toHaveBeenCalledTimes(1);
    // The mapped, validated candidate reaches the shared insert path under canonical names.
    const inserted = insertPropertyRow.mock.calls[0]![2] as {
      reference: string;
      postcode: string;
      listingType: string;
    };
    expect(inserted.reference).toBe('REF-100');
    expect(inserted.postcode).toBe('M21 9WN');
    expect(inserted.listingType).toBe('residential');
    expect(res.counts).toMatchObject({ input: 1, created: 1, failed: 0 });
  });

  it('without a mapping a raw CRM export fails every row (backward compat)', async () => {
    const res = await importPropertiesFromCsv(
      { ok: false },
      csvForm(`${REAPIT_HEADER}\n${REAPIT_ROW}\n`),
    );
    expect(res.ok).toBe(true);
    expect(insertPropertyRow).not.toHaveBeenCalled();
    expect(res.counts).toMatchObject({ input: 1, created: 0, failed: 1 });
  });

  it('stores a null errorSummary when no rows failed', async () => {
    await importPropertiesFromCsv({ ok: false }, csvForm(`${HEADER}\n${GOOD_1}\n`));
    const data = importLogCreate.mock.calls[0]![0].data as { errorSummary: unknown };
    expect(data.errorSummary).toBeNull();
  });

  // FR-X-5 — DB-constraint failures are isolated per row exactly like validation
  // failures: a duplicate `reference` (P2002 on @@unique([tenantId, reference])) must
  // record THAT row as failed and continue, never abort the whole run (audit finding
  // import-duplicate-reference-aborts-whole-run).
  describe('per-row DB-error isolation (FR-X-5)', () => {
    it('records a duplicate-reference row as failed and imports the rest', async () => {
      insertPropertyRow.mockRejectedValueOnce(p2002());
      const res = await importPropertiesFromCsv(
        { ok: false },
        csvForm(`${HEADER}\n${GOOD_1}\n${GOOD_2}\n`),
      );
      expect(res.ok).toBe(true);
      // BOTH rows were attempted; the duplicate failed, the other row still imported.
      expect(insertPropertyRow).toHaveBeenCalledTimes(2);
      expect(res.counts).toMatchObject({ input: 2, created: 1, failed: 1 });
      // The failure names the row and the duplicate reference.
      expect(res.errorSummary).toHaveLength(1);
      expect(res.errorSummary![0]).toContain('Row 1');
      expect(res.errorSummary![0]).toMatch(/reference/i);
      // The ONE import_logs row reflects the mixed outcome.
      expect(importLogCreate).toHaveBeenCalledTimes(1);
      const data = importLogCreate.mock.calls[0]![0].data as Record<string, unknown>;
      expect(data).toMatchObject({ recordsCreated: 1, recordsFailed: 1 });
      expect(data['errorSummary']).toEqual({ rows: res.errorSummary });
    });

    it('audits the failed row individually (FR-X-9) alongside the run audit', async () => {
      insertPropertyRow.mockRejectedValueOnce(p2002());
      await importPropertiesFromCsv({ ok: false }, csvForm(`${HEADER}\n${GOOD_1}\n${GOOD_2}\n`));
      const actions = audit.mock.calls.map((call) => (call[1] as { action: string }).action);
      expect(actions).toContain('property.imported');
      const rowFailAudit = audit.mock.calls.find(
        (call) => (call[1] as { action: string }).action === 'property.import_row_failed',
      );
      expect(rowFailAudit).toBeDefined();
      expect((rowFailAudit![1] as { diff: { rowNumber: number } }).diff.rowNumber).toBe(1);
    });

    it('wraps each row insert in a savepoint so a failed row rolls back alone', async () => {
      insertPropertyRow.mockRejectedValueOnce(p2002());
      await importPropertiesFromCsv({ ok: false }, csvForm(`${HEADER}\n${GOOD_1}\n${GOOD_2}\n`));
      const statements = executeRawUnsafe.mock.calls.map((call) => String(call[0]));
      // Every attempted row opens a savepoint; the failed row rolls back to it, so the
      // aborted INSERT never poisons the surrounding tenant transaction (import_log +
      // run audit + surviving rows still commit together).
      expect(statements.filter((s) => s.startsWith('SAVEPOINT '))).toHaveLength(2);
      expect(statements.some((s) => s.startsWith('ROLLBACK TO SAVEPOINT '))).toBe(true);
    });

    it('isolates a non-P2002 insert failure with a generic row error', async () => {
      insertPropertyRow.mockRejectedValueOnce(new Error('connection reset'));
      const res = await importPropertiesFromCsv(
        { ok: false },
        csvForm(`${HEADER}\n${GOOD_1}\n${GOOD_2}\n`),
      );
      expect(res.ok).toBe(true);
      expect(res.counts).toMatchObject({ created: 1, failed: 1 });
      expect(res.errorSummary![0]).toContain('Row 1');
    });
  });

  // EPIC-AD / G12 — the import path must enforce pack entitlement SERVER-SIDE like the
  // create action: a row authoring a pack-gated vertical the tenant has not enabled is
  // recorded as failed (row-isolated), never inserted (audit finding
  // vertical-pack-entitlement-not-enforced-server-side).
  describe('pack entitlement (G12 server-side)', () => {
    const COMMERCIAL_ROW = 'REF-C1,commercial,sale,1 Bridge St,M3 3BZ,Unit One,Manchester';

    it('fails rows whose vertical listing type is not enabled and imports the rest', async () => {
      isListingTypePermitted.mockImplementation(async (type: unknown) => type !== 'commercial');
      const res = await importPropertiesFromCsv(
        { ok: false },
        csvForm(`${HEADER}\n${GOOD_1}\n${COMMERCIAL_ROW}\n`),
      );
      expect(res.ok).toBe(true);
      expect(isListingTypePermitted).toHaveBeenCalledWith('commercial');
      // Only the permitted row reaches the insert path.
      expect(insertPropertyRow).toHaveBeenCalledTimes(1);
      expect(res.counts).toMatchObject({ input: 2, created: 1, failed: 1 });
      expect(res.errorSummary).toHaveLength(1);
      expect(res.errorSummary![0]).toContain('Row 2');
      expect(res.errorSummary![0]).toMatch(/pack/i);
      // The denied row is audited individually like any other failed row (FR-X-9).
      const rowFailAudit = audit.mock.calls.find(
        (call) => (call[1] as { action: string }).action === 'property.import_row_failed',
      );
      expect(rowFailAudit).toBeDefined();
      expect((rowFailAudit![1] as { diff: { rowNumber: number } }).diff.rowNumber).toBe(2);
    });

    it('imports pack-gated rows when the tenant HAS the pack enabled', async () => {
      isListingTypePermitted.mockResolvedValue(true);
      const res = await importPropertiesFromCsv(
        { ok: false },
        csvForm(`${HEADER}\n${COMMERCIAL_ROW}\n`),
      );
      expect(res.ok).toBe(true);
      expect(insertPropertyRow).toHaveBeenCalledTimes(1);
      expect(res.counts).toMatchObject({ input: 1, created: 1, failed: 0 });
    });
  });
});
