import { beforeEach, describe, expect, it, vi } from 'vitest';

// EPIC-X FR-X-2 / FR-X-4 / FR-X-5 / FR-X-6 / FR-X-10 — UPSERT mode on the audited bulk
// CSV import action (audit finding import-upsert-mode-not-implemented).
//
// The form posts an import `mode` (create_only | upsert_reference | upsert_external_id).
// In an upsert mode the action reads the tenant's existing property identities inside
// the SAME tenant transaction, matches each incoming row on the chosen field (FR-X-4),
// UPDATES matched rows through the shared updatePropertyRow write path, CREATES the
// rest through the shared insertPropertyRow path, and SKIPS rows that carry no match
// value in external-id mode (they could never be de-duplicated on a re-run). Counts
// (created / updated / skipped / failed) land on the ONE import_logs row (FR-X-6);
// per-row isolation (FR-X-5) and the per-failed-row audits (FR-X-9) apply to update
// failures exactly like insert failures; the FR-X-10 quota counts only NET-NEW
// published rows — an all-matched re-run consumes no headroom. Mocks mirror
// actions.test.ts: staff-session / tenant / db seams + the shared write paths.

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

const isListingTypePermitted = vi.fn();
vi.mock('../../../lib/packs.js', () => ({
  isListingTypePermitted: (...a: unknown[]) => isListingTypePermitted(...a),
}));

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

// The two shared write paths — spied so this test exercises the upsert ORCHESTRATION,
// not the (separately-tested) property insert/update internals.
const insertPropertyRow = vi.fn(
  async (_tx: unknown, _ctx: unknown, input: { reference: string }, taken: Set<string>) => {
    const slug = `slug-${input.reference}`;
    taken.add(slug);
    return { id: `id-${input.reference}`, slug };
  },
);
type UpdateRowArgs = [
  unknown,
  { tenantId: string; actor: string; createdByUserId: string | null },
  { reference: string },
  { id: string },
  string,
];
const updatePropertyRow = vi.fn(async (..._args: UpdateRowArgs) => undefined);
vi.mock('../property-insert.js', () => ({
  insertPropertyRow: (...a: unknown[]) =>
    insertPropertyRow(...(a as [unknown, unknown, { reference: string }, Set<string>])),
  updatePropertyRow: (...a: unknown[]) => updatePropertyRow(...(a as UpdateRowArgs)),
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
  'reference,externalId,listingType,saleType,displayAddress,postcode,title,publicationStatus';

/** One CSV data row with an optional external id and publication status. */
function csvRow(
  reference: string,
  externalId = '',
  publicationStatus: 'draft' | 'published' = 'draft',
): string {
  return `${reference},${externalId},residential,sale,12 Acacia Ave,M21 9WN,Flat,${publicationStatus}`;
}

/** A FormData carrying a CSV file (jsdom's File lacks .text(); attach one) and a mode. */
function csvForm(csvText: string, mode?: string): FormData {
  const file = new File([csvText], 'catalogue.csv', { type: 'text/csv' });
  Object.defineProperty(file, 'text', { value: async () => csvText });
  const fd = new FormData();
  fd.set('file', file);
  if (mode !== undefined) fd.set('mode', mode);
  return fd;
}

/** An existing property identity row as the match-key read returns it. */
interface ExistingRow {
  id: string;
  reference: string;
  externalId: string | null;
  slug: string;
}

/**
 * Serve BOTH tenant-scoped findMany reads the action performs: the slug seed
 * (select { slug }) and the upsert match-key read (select includes `reference`).
 */
function seedExisting(rows: ExistingRow[]): void {
  propertyFindMany.mockImplementation(async (args?: { select?: Record<string, unknown> }) =>
    args?.select !== undefined && 'reference' in args.select
      ? rows.map(({ id, reference, externalId }) => ({ id, reference, externalId }))
      : rows.map(({ slug }) => ({ slug })),
  );
}

/** A P2002-shaped (unique-constraint) error, as Prisma raises for a duplicate reference. */
function p2002(): Error {
  const error = new Error('Unique constraint failed on the fields: (`tenantId`,`reference`)');
  (error as Error & { code: string }).code = 'P2002';
  return error;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireStaffPermission.mockResolvedValue(undefined);
  getStaffActor.mockResolvedValue('agent:albert-aardvark');
  getStaffUserId.mockResolvedValue(USER_ID);
  getCurrentTenantId.mockResolvedValue(TENANT);
  getRequestIp.mockResolvedValue('203.0.113.7');
  seedExisting([]);
  propertyCount.mockResolvedValue(0);
  importLogCreate.mockResolvedValue({ id: LOG_ID });
  isListingTypePermitted.mockResolvedValue(true);
  getTenantActiveListingQuota.mockResolvedValue(Infinity);
});

describe('importPropertiesFromCsv — upsert mode (FR-X-2 / FR-X-4)', () => {
  it('defaults to create-only when no mode is posted: a matching reference is NOT updated', async () => {
    seedExisting([{ id: 'p-1', reference: 'REF-001', externalId: null, slug: 'existing-1' }]);
    await importPropertiesFromCsv({ ok: false }, csvForm(`${HEADER}\n${csvRow('REF-001')}\n`));
    expect(updatePropertyRow).not.toHaveBeenCalled();
    expect(insertPropertyRow).toHaveBeenCalledTimes(1);
  });

  it('updates a reference-matched row through the shared write path and creates the rest', async () => {
    seedExisting([{ id: 'p-1', reference: 'REF-001', externalId: null, slug: 'existing-1' }]);
    const res = await importPropertiesFromCsv(
      { ok: false },
      csvForm(`${HEADER}\n${csvRow('REF-001')}\n${csvRow('REF-NEW')}\n`, 'upsert_reference'),
    );
    expect(res.ok).toBe(true);
    // The matched row goes through updatePropertyRow against the matched property id.
    expect(updatePropertyRow).toHaveBeenCalledTimes(1);
    const [, ctx, input, target, matchedOn] = updatePropertyRow.mock.calls[0]!;
    expect(input.reference).toBe('REF-001');
    expect(target).toEqual({ id: 'p-1' });
    expect(matchedOn).toBe('reference');
    expect(ctx).toMatchObject({ tenantId: TENANT, createdByUserId: USER_ID });
    // The unmatched row is created through the shared insert path.
    expect(insertPropertyRow).toHaveBeenCalledTimes(1);
    expect(res.counts).toMatchObject({ input: 2, created: 1, updated: 1, skipped: 0, failed: 0 });
  });

  it('re-running the same file in upsert mode creates no duplicates (acceptance criterion)', async () => {
    // The catalogue already contains every row of the file (the first run created them).
    seedExisting([
      { id: 'p-1', reference: 'REF-001', externalId: null, slug: 'existing-1' },
      { id: 'p-2', reference: 'REF-002', externalId: null, slug: 'existing-2' },
    ]);
    const res = await importPropertiesFromCsv(
      { ok: false },
      csvForm(`${HEADER}\n${csvRow('REF-001')}\n${csvRow('REF-002')}\n`, 'upsert_reference'),
    );
    expect(res.ok).toBe(true);
    // NOTHING is created on the re-run — every row updates its existing listing.
    expect(insertPropertyRow).not.toHaveBeenCalled();
    expect(updatePropertyRow).toHaveBeenCalledTimes(2);
    expect(res.counts).toMatchObject({ input: 2, created: 0, updated: 2, failed: 0 });
  });

  it('matches on external id in upsert_external_id mode, regardless of reference (FR-X-4)', async () => {
    seedExisting([{ id: 'p-9', reference: 'OLD-REF', externalId: 'EXT-1', slug: 'old' }]);
    const res = await importPropertiesFromCsv(
      { ok: false },
      csvForm(`${HEADER}\n${csvRow('REF-001', 'EXT-1')}\n`, 'upsert_external_id'),
    );
    expect(res.ok).toBe(true);
    expect(updatePropertyRow).toHaveBeenCalledTimes(1);
    const target = updatePropertyRow.mock.calls[0]![3];
    const matchedOn = updatePropertyRow.mock.calls[0]![4];
    expect(target).toEqual({ id: 'p-9' });
    expect(matchedOn).toBe('externalId');
    expect(res.counts).toMatchObject({ created: 0, updated: 1 });
  });

  it('skips a row without an external id in external-id mode and records it (never blind-creates)', async () => {
    const res = await importPropertiesFromCsv(
      { ok: false },
      csvForm(`${HEADER}\n${csvRow('REF-001', 'EXT-1')}\n${csvRow('REF-002')}\n`, 'upsert_external_id'),
    );
    expect(res.ok).toBe(true);
    // Row 1 has an external id (no match → created); row 2 has none → skipped.
    expect(insertPropertyRow).toHaveBeenCalledTimes(1);
    expect(updatePropertyRow).not.toHaveBeenCalled();
    expect(res.counts).toMatchObject({ input: 2, created: 1, updated: 0, skipped: 1, failed: 0 });
    expect(res.skippedSummary).toHaveLength(1);
    expect(res.skippedSummary![0]).toContain('Row 2');
    // A skipped row is not a failure: it gets no property.import_row_failed audit.
    const rowFailAudits = audit.mock.calls.filter(
      (call) => (call[1] as { action: string }).action === 'property.import_row_failed',
    );
    expect(rowFailAudits).toHaveLength(0);
    // The ONE import_logs row records the skip.
    const data = importLogCreate.mock.calls[0]![0].data as Record<string, unknown>;
    expect(data).toMatchObject({ recordsCreated: 1, recordsUpdated: 0, recordsSkipped: 1 });
  });

  it('isolates a failing UPDATE row: the rest of the run still imports (FR-X-5)', async () => {
    seedExisting([
      { id: 'p-1', reference: 'REF-001', externalId: null, slug: 'existing-1' },
      { id: 'p-2', reference: 'REF-002', externalId: null, slug: 'existing-2' },
    ]);
    updatePropertyRow.mockRejectedValueOnce(p2002());
    const res = await importPropertiesFromCsv(
      { ok: false },
      csvForm(`${HEADER}\n${csvRow('REF-001')}\n${csvRow('REF-002')}\n`, 'upsert_reference'),
    );
    expect(res.ok).toBe(true);
    expect(updatePropertyRow).toHaveBeenCalledTimes(2);
    expect(res.counts).toMatchObject({ input: 2, created: 0, updated: 1, failed: 1 });
    expect(res.errorSummary).toHaveLength(1);
    expect(res.errorSummary![0]).toContain('Row 1');
    // The failed update rolled back to its own savepoint — the run survived.
    const statements = executeRawUnsafe.mock.calls.map((call) => String(call[0]));
    expect(statements.some((s) => s.startsWith('ROLLBACK TO SAVEPOINT '))).toBe(true);
    // FR-X-9 — the failed row is audited individually.
    const rowFailAudit = audit.mock.calls.find(
      (call) => (call[1] as { action: string }).action === 'property.import_row_failed',
    );
    expect(rowFailAudit).toBeDefined();
    expect((rowFailAudit![1] as { diff: { rowNumber: number } }).diff.rowNumber).toBe(1);
  });

  it('writes the updated/skipped counts onto the ONE import_logs row (FR-X-6)', async () => {
    seedExisting([{ id: 'p-1', reference: 'REF-001', externalId: null, slug: 'existing-1' }]);
    await importPropertiesFromCsv(
      { ok: false },
      csvForm(`${HEADER}\n${csvRow('REF-001')}\n${csvRow('REF-NEW')}\n`, 'upsert_reference'),
    );
    expect(importLogCreate).toHaveBeenCalledTimes(1);
    const data = importLogCreate.mock.calls[0]![0].data as Record<string, unknown>;
    expect(data).toMatchObject({
      tenantId: TENANT,
      source: 'csv_upload',
      recordsInput: 2,
      recordsCreated: 1,
      recordsUpdated: 1,
      recordsSkipped: 0,
      recordsFailed: 0,
    });
  });

  it('records the mode on the property.imported run audit (FR-X-9 / G4)', async () => {
    seedExisting([{ id: 'p-1', reference: 'REF-001', externalId: null, slug: 'existing-1' }]);
    await importPropertiesFromCsv(
      { ok: false },
      csvForm(`${HEADER}\n${csvRow('REF-001')}\n`, 'upsert_reference'),
    );
    const runAudit = audit.mock.calls.find(
      (call) => (call[1] as { action: string }).action === 'property.imported',
    );
    expect(runAudit).toBeDefined();
    expect((runAudit![1] as { diff: Record<string, unknown> }).diff).toMatchObject({
      mode: 'upsert_reference',
      updated: 1,
    });
  });

  it('falls back to create-only for an unrecognised mode value (fail-safe)', async () => {
    seedExisting([{ id: 'p-1', reference: 'REF-001', externalId: null, slug: 'existing-1' }]);
    await importPropertiesFromCsv(
      { ok: false },
      csvForm(`${HEADER}\n${csvRow('REF-001')}\n`, 'delete_everything'),
    );
    expect(updatePropertyRow).not.toHaveBeenCalled();
    expect(insertPropertyRow).toHaveBeenCalledTimes(1);
  });
});

describe('importPropertiesFromCsv — upsert quota (FR-X-10, net-new only)', () => {
  it('a fully-matched published re-run consumes NO quota headroom at the cap', async () => {
    getTenantActiveListingQuota.mockResolvedValue(100);
    propertyCount.mockResolvedValue(100); // already at the active cap
    seedExisting([
      { id: 'p-1', reference: 'REF-001', externalId: null, slug: 'existing-1' },
      { id: 'p-2', reference: 'REF-002', externalId: null, slug: 'existing-2' },
    ]);
    const res = await importPropertiesFromCsv(
      { ok: false },
      csvForm(
        `${HEADER}\n${csvRow('REF-001', '', 'published')}\n${csvRow('REF-002', '', 'published')}\n`,
        'upsert_reference',
      ),
    );
    // Updates are not net-new active listings — the re-run must not abort on quota.
    expect(res.ok).toBe(true);
    expect(updatePropertyRow).toHaveBeenCalledTimes(2);
    const runAudit = audit.mock.calls.find(
      (call) => (call[1] as { action: string }).action === 'property.imported',
    );
    expect((runAudit![1] as { diff: { quota: { incoming: number } } }).diff.quota.incoming).toBe(0);
  });

  it('still aborts when the NET-NEW published rows alone would exceed the quota', async () => {
    getTenantActiveListingQuota.mockResolvedValue(100);
    propertyCount.mockResolvedValue(100);
    seedExisting([{ id: 'p-1', reference: 'REF-001', externalId: null, slug: 'existing-1' }]);
    const res = await importPropertiesFromCsv(
      { ok: false },
      csvForm(
        `${HEADER}\n${csvRow('REF-001', '', 'published')}\n${csvRow('REF-NEW', '', 'published')}\n`,
        'upsert_reference',
      ),
    );
    expect(res.ok).toBe(false);
    expect(res.errors?.[0]?.message ?? '').toMatch(/quota/i);
    expect(insertPropertyRow).not.toHaveBeenCalled();
    expect(updatePropertyRow).not.toHaveBeenCalled();
    expect(importLogCreate).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });
});
