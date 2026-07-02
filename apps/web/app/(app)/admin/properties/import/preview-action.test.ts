import { beforeEach, describe, expect, it, vi } from 'vitest';

// EPIC-X FR-X-2 — the DRY-RUN preview action. It parses + validates the upload with the
// SAME pure core as the real import, reports total records / valid / invalid counts, a
// sample of the first ten mapped rows, and the per-row validation errors — WITHOUT
// creating any property and WITHOUT writing an import_logs row or ANY audit. RBAC is
// fail-closed on `property.write` first (the same gate as the real import). The DB /
// audit seams are mocked so the test can prove zero persistence: no withTenant, no
// insert, no importLog.create, no audit — a preview never touches the database.

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

// The persistence seams — a preview must NEVER call any of them. Spied so the test can
// assert zero side effects.
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
const GOOD_1 = 'REF-001,residential,sale,12 Acacia Ave,M21 9WN,Flat One,Chorlton';
const GOOD_2 = 'REF-002,residential,sale,14 Acacia Ave,M21 9WN,Flat Two,Chorlton';
const BAD_MISSING_POSTCODE = 'REF-003,residential,sale,16 Acacia Ave,,Flat Three,Chorlton';

/**
 * A FormData carrying a CSV file with the given text. jsdom's `File` does not implement
 * `.text()`, so we attach a working one — the action reads the upload via `file.text()`,
 * and `instanceof File` must still hold for the type/size checks.
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

/** Build a HEADER + N synthetic valid data rows for the sample-limit assertion. */
function manyRows(count: number): string {
  const rows: string[] = [HEADER];
  for (let i = 0; i < count; i += 1) {
    rows.push(`REF-${i},residential,sale,${i} Acacia Ave,M21 9WN,Flat ${i},Chorlton`);
  }
  return `${rows.join('\n')}\n`;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireStaffPermission.mockResolvedValue(undefined);
  getCurrentTenantId.mockResolvedValue(TENANT);
  getRequestIp.mockResolvedValue('203.0.113.7');
});

describe('previewPropertyImport', () => {
  it('denies when the staff role lacks property.write (fail-closed) — nothing read or written', async () => {
    requireStaffPermission.mockRejectedValue(new Error('forbidden'));
    const res = await previewPropertyImport({ ok: false }, csvForm(`${HEADER}\n${GOOD_1}\n`));
    expect(res.ok).toBe(false);
    expect(res.preview).toBeUndefined();
    // A denial must not touch persistence in any way.
    expect(withTenant).not.toHaveBeenCalled();
    expect(insertPropertyRow).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('gates on property.write (the same permission as the real import)', async () => {
    await previewPropertyImport({ ok: false }, csvForm(`${HEADER}\n${GOOD_1}\n`));
    expect(requireStaffPermission).toHaveBeenCalledWith('property.write');
  });

  it('rejects a submission with no file before parsing', async () => {
    const res = await previewPropertyImport({ ok: false }, new FormData());
    expect(res.ok).toBe(false);
    expect(res.preview).toBeUndefined();
  });

  it('rejects a non-CSV file', async () => {
    const res = await previewPropertyImport(
      { ok: false },
      csvForm('reference\nX', 'notes.txt', 'text/plain'),
    );
    expect(res.ok).toBe(false);
    expect(res.preview).toBeUndefined();
  });

  it('reports a parse error for an empty CSV (no data rows)', async () => {
    const res = await previewPropertyImport({ ok: false }, csvForm(`${HEADER}\n`));
    expect(res.ok).toBe(false);
    expect(res.errors && res.errors.length).toBeGreaterThan(0);
    expect(res.preview).toBeUndefined();
  });

  it('previews a clean file: counts, sample and recognised columns, zero invalid', async () => {
    const res = await previewPropertyImport(
      { ok: false },
      csvForm(`${HEADER}\n${GOOD_1}\n${GOOD_2}\n`),
    );
    expect(res.ok).toBe(true);
    expect(res.preview).toBeDefined();
    expect(res.preview!.counts).toEqual({ input: 2, valid: 2, invalid: 0 });
    expect(res.preview!.sample).toHaveLength(2);
    expect(res.preview!.sample[0]!.reference).toBe('REF-001');
    expect(res.preview!.recognisedColumns).toContain('reference');
    expect(res.preview!.recognisedColumns).toContain('postcode');
    expect(res.preview!.errors).toHaveLength(0);
  });

  it('reports a mixed valid/invalid file with per-row errors and continues (FR-X-2/5)', async () => {
    const res = await previewPropertyImport(
      { ok: false },
      csvForm(`${HEADER}\n${GOOD_1}\n${BAD_MISSING_POSTCODE}\n`),
    );
    expect(res.ok).toBe(true);
    expect(res.preview!.counts).toEqual({ input: 2, valid: 1, invalid: 1 });
    expect(res.preview!.errors).toHaveLength(1);
    // The invalid row is the 2nd data row and names its reason.
    expect(res.preview!.errors[0]).toContain('Row 2');
  });

  it('limits the sample to the first ten records (FR-X-2)', async () => {
    const res = await previewPropertyImport({ ok: false }, csvForm(manyRows(15)));
    expect(res.ok).toBe(true);
    // 15 records detected, but the preview sample shows only the first ten.
    expect(res.preview!.counts.input).toBe(15);
    expect(res.preview!.sample).toHaveLength(10);
  });

  it('surfaces ignored (unrecognised) columns without failing the preview', async () => {
    const header = `${HEADER},crm_id`;
    const row = `${GOOD_1},XYZ`;
    const res = await previewPropertyImport({ ok: false }, csvForm(`${header}\n${row}\n`));
    expect(res.ok).toBe(true);
    expect(res.preview!.ignoredColumns).toContain('crm_id');
  });

  it('auto-detects a Reapit CSV and reports the suggested preset (FR-X-3)', async () => {
    // No mapping supplied: the preview detects the CRM from the raw headers so the form
    // can pre-select the preset.
    const res = await previewPropertyImport(
      { ok: false },
      csvForm(`${REAPIT_HEADER}\n${REAPIT_ROW}\n`),
    );
    expect(res.ok).toBe(true);
    expect(res.preview!.detectedPreset).toBe('reapit');
  });

  it('reports no detected preset for a canonical-header CSV (custom mapping option)', async () => {
    const res = await previewPropertyImport({ ok: false }, csvForm(`${HEADER}\n${GOOD_1}\n`));
    expect(res.ok).toBe(true);
    expect(res.preview!.detectedPreset).toBeNull();
  });

  it('applies a mapping from FormData so a CRM export previews cleanly (FR-X-3)', async () => {
    const res = await previewPropertyImport(
      { ok: false },
      csvFormWithMapping(`${REAPIT_HEADER}\n${REAPIT_ROW}\n`, REAPIT_MAP),
    );
    expect(res.ok).toBe(true);
    expect(res.preview!.counts).toEqual({ input: 1, valid: 1, invalid: 0 });
    expect(res.preview!.sample[0]!.reference).toBe('REF-100');
    expect(res.preview!.ignoredColumns).toHaveLength(0);
  });

  it('ignores a malformed mapping JSON and falls back to header-as-is', async () => {
    const fd = csvForm(`${HEADER}\n${GOOD_1}\n`);
    fd.set('mapping', 'not json');
    const res = await previewPropertyImport({ ok: false }, fd);
    // A bad mapping must not crash the dry run; the canonical CSV still previews.
    expect(res.ok).toBe(true);
    expect(res.preview!.counts.valid).toBe(1);
  });

  it('NEVER persists: no tenant transaction, no insert, no import log, no audit (dry run)', async () => {
    await previewPropertyImport(
      { ok: false },
      csvForm(`${HEADER}\n${GOOD_1}\n${BAD_MISSING_POSTCODE}\n`),
    );
    expect(withTenant).not.toHaveBeenCalled();
    expect(insertPropertyRow).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });
});
