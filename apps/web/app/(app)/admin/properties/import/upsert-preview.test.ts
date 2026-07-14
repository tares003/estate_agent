import { beforeEach, describe, expect, it, vi } from 'vitest';

// EPIC-X FR-X-2 / FR-X-4 — the dry-run preview simulates the chosen import MODE.
//
// The preview echoes the posted mode and reports what the confirmed run WOULD do:
// wouldCreate / wouldUpdate / wouldSkip. In an upsert mode it performs a tenant-scoped
// READ of the existing property identities (id + reference + externalId) and runs the
// SAME pure planner as the real import — still creating nothing: no property insert, no
// import_logs row, no audit. The FR-X-10 quota projection counts only NET-NEW published
// rows in upsert mode, so a re-run of an already-imported file shows zero incoming.

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

// FR-X-10 — the quota read the preview surfaces (best-effort). Stubbed so the
// net-new projection can be asserted deterministically.
const readActiveListingUsage = vi.fn();
vi.mock('../../../lib/import-quota.js', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/import-quota.js')>(
    '../../../lib/import-quota.js',
  );
  return {
    ...actual,
    readActiveListingUsage: () => readActiveListingUsage(),
  };
});

const audit = vi.fn();
const importLogCreate = vi.fn();
const propertyFindMany = vi.fn();
const propertyCreate = vi.fn();
const withTenant = vi.fn(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
  fn({
    property: { findMany: propertyFindMany, create: propertyCreate },
    importLog: { create: importLogCreate },
  }),
);
vi.mock('@estate/db', () => ({ withTenant, audit }));

const { previewPropertyImport } = await import('./preview-action.js');

const TENANT = '00000000-0000-0000-0000-000000000001';

const HEADER =
  'reference,externalId,listingType,saleType,displayAddress,postcode,title,publicationStatus';

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

beforeEach(() => {
  vi.clearAllMocks();
  requireStaffPermission.mockResolvedValue(undefined);
  getCurrentTenantId.mockResolvedValue(TENANT);
  getRequestIp.mockResolvedValue('203.0.113.7');
  propertyFindMany.mockResolvedValue([]);
  readActiveListingUsage.mockResolvedValue({ limit: Infinity, existingActive: 0 });
});

describe('previewPropertyImport — per-mode outcome (FR-X-2)', () => {
  it('echoes create-only: every valid row would be created, none updated', async () => {
    const res = await previewPropertyImport(
      { ok: false },
      csvForm(`${HEADER}\n${csvRow('REF-001')}\n${csvRow('REF-002')}\n`),
    );
    expect(res.ok).toBe(true);
    expect(res.preview!.mode).toBe('create_only');
    expect(res.preview!.outcome).toEqual({ wouldCreate: 2, wouldUpdate: 0, wouldSkip: 0 });
    // Create-only needs no catalogue read — the dry run stays transaction-free.
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('previews what an upsert on reference WOULD create vs update (FR-X-2/4)', async () => {
    propertyFindMany.mockResolvedValue([{ id: 'p-1', reference: 'REF-001', externalId: null }]);
    const res = await previewPropertyImport(
      { ok: false },
      csvForm(`${HEADER}\n${csvRow('REF-001')}\n${csvRow('REF-NEW')}\n`, 'upsert_reference'),
    );
    expect(res.ok).toBe(true);
    expect(res.preview!.mode).toBe('upsert_reference');
    expect(res.preview!.outcome).toEqual({ wouldCreate: 1, wouldUpdate: 1, wouldSkip: 0 });
  });

  it('previews the skipped rows of an external-id upsert (rows with no external id)', async () => {
    const res = await previewPropertyImport(
      { ok: false },
      csvForm(
        `${HEADER}\n${csvRow('REF-001', 'EXT-1')}\n${csvRow('REF-002')}\n`,
        'upsert_external_id',
      ),
    );
    expect(res.ok).toBe(true);
    expect(res.preview!.outcome).toEqual({ wouldCreate: 1, wouldUpdate: 0, wouldSkip: 1 });
  });

  it('projects the quota over NET-NEW published rows only in upsert mode (FR-X-10)', async () => {
    // At the cap, but every published row in the file matches an existing listing —
    // the preview must show the re-run fits (incoming 0, no exceed warning).
    readActiveListingUsage.mockResolvedValue({ limit: 100, existingActive: 100 });
    propertyFindMany.mockResolvedValue([
      { id: 'p-1', reference: 'REF-001', externalId: null },
      { id: 'p-2', reference: 'REF-002', externalId: null },
    ]);
    const res = await previewPropertyImport(
      { ok: false },
      csvForm(
        `${HEADER}\n${csvRow('REF-001', '', 'published')}\n${csvRow('REF-002', '', 'published')}\n`,
        'upsert_reference',
      ),
    );
    expect(res.ok).toBe(true);
    expect(res.preview!.quota).toMatchObject({ incoming: 0, wouldExceed: false });
  });

  it('still warns when the net-new published rows would exceed the cap', async () => {
    readActiveListingUsage.mockResolvedValue({ limit: 100, existingActive: 100 });
    propertyFindMany.mockResolvedValue([{ id: 'p-1', reference: 'REF-001', externalId: null }]);
    const res = await previewPropertyImport(
      { ok: false },
      csvForm(
        `${HEADER}\n${csvRow('REF-001', '', 'published')}\n${csvRow('REF-NEW', '', 'published')}\n`,
        'upsert_reference',
      ),
    );
    expect(res.ok).toBe(true);
    expect(res.preview!.quota).toMatchObject({ incoming: 1, wouldExceed: true });
  });

  it('an upsert preview stays a dry run: reads the catalogue, writes NOTHING', async () => {
    propertyFindMany.mockResolvedValue([{ id: 'p-1', reference: 'REF-001', externalId: null }]);
    await previewPropertyImport(
      { ok: false },
      csvForm(`${HEADER}\n${csvRow('REF-001')}\n`, 'upsert_reference'),
    );
    expect(propertyCreate).not.toHaveBeenCalled();
    expect(importLogCreate).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });
});
