import { beforeEach, describe, expect, it, vi } from 'vitest';

// EPIC-X FR-X-5 / FR-X-9 + EPIC-F FR-F-4 / FR-F-11 — the bulk import driving the REAL
// shared insert path, end to end.
//
// Audit finding import-insertpropertyrow-overmock-batch-gap: the other two import suites
// (actions.test.ts, quota-enforcement.test.ts) `vi.mock('../property-insert.js')` and
// replace `insertPropertyRow` with a fake that mints `slug-${reference}` — unique per row
// by construction. That over-mock is deliberate (those suites assert the ORCHESTRATION —
// RBAC, row isolation, savepoints, the import_logs row, the quota gate), but it means the
// REAL insert path was never driven across MULTIPLE rows of one run. Three things went
// unproven as a result:
//
//   (a) in-run slug-collision ACCUMULATION — `insertPropertyRow` reserves each slug it
//       mints in the run's shared `taken` set, so several rows deriving the SAME base
//       slug must come out `base`, `base-2`, `base-3`, … If the set stopped being
//       threaded across rows (or stopped being mutated), every row would mint the same
//       slug and @@unique([tenantId, slug]) would abort the run;
//   (b) `disambiguateSlug`'s suffix loop PAST 2 — the admin create/update actions only
//       ever collide once (`base` → `base-2`);
//   (c) the per-row `property.created` AUDIT row the real insert emits (G4) — mocked away
//       and never verified for a batch.
//
// So this suite mocks EVERYTHING EXCEPT the write path: `../property-insert.js` is the
// real module and `audit` is the real `@estate/db` writer, so every `property.created`
// row lands on the fake tx's `auditLog.create` exactly as it would on Prisma's.

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

const isListingTypePermitted = vi.fn();
vi.mock('../../../lib/packs.js', () => ({
  isListingTypePermitted: (...a: unknown[]) => isListingTypePermitted(...a),
}));

const getTenantActiveListingQuota = vi.fn();
vi.mock('../../../lib/import-quota.js', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/import-quota.js')>(
    '../../../lib/import-quota.js',
  );
  return { ...actual, getTenantActiveListingQuota: () => getTenantActiveListingQuota() };
});

// NOTE the deliberate absence of a `vi.mock('../property-insert.js')` here — that is the
// whole point of this suite. `insertPropertyRow` + `disambiguateSlug` run for real.

// `@estate/db` keeps its REAL `audit` (so the per-row audit row is genuinely written
// through the shared writer onto the tx below); only `withTenant` is faked, to hand the
// action a fake transaction instead of opening a Postgres one.
const withTenant = vi.fn();
vi.mock('@estate/db', async () => {
  const actual = await vi.importActual<typeof import('@estate/db')>('@estate/db');
  return {
    ...actual,
    withTenant: (...a: unknown[]) =>
      withTenant(...(a as [unknown, string, (tx: unknown) => unknown])),
  };
});

const { importPropertiesFromCsv } = await import('./actions.js');

const TENANT = '00000000-0000-0000-0000-000000000001';
const USER_ID = '22222222-2222-2222-2222-222222222222';
const LOG_ID = '33333333-3333-3333-3333-333333333333';
const IP = '203.0.113.7';
const USER_AGENT = 'Mozilla/5.0 (Test)';

const HEADER = 'reference,listingType,saleType,displayAddress,postcode,title,town';

/**
 * Three rows a real CRM export would produce for one converted building: distinct
 * references and door numbers, but the SAME title, town and postcode district — so all
 * three derive the SAME base slug (`propertySlugBase` = title + town + postcode prefix)
 * and the run must disambiguate them against each other.
 */
const SAME_BASE_1 = 'REF-001,residential,sale,Flat 1 Acacia House,M21 9WN,Acacia House,Chorlton';
const SAME_BASE_2 = 'REF-002,residential,sale,Flat 2 Acacia House,M21 9WN,Acacia House,Chorlton';
const SAME_BASE_3 = 'REF-003,residential,sale,Flat 3 Acacia House,M21 9WN,Acacia House,Chorlton';

/** The base slug all three rows above derive: slugify(title)-slugify(town)-postcodePrefix. */
const BASE = 'acacia-house-chorlton-m21';

/** A row deriving a DIFFERENT base — it must be untouched by the collision walk. */
const OTHER_BASE = 'REF-009,residential,sale,7 Beech Road,M20 2WS,Beech Cottage,Didsbury';
const OTHER = 'beech-cottage-didsbury-m20';

/** Existing tenant slugs the run seeds `taken` from (empty by default). */
let existingSlugs: { slug: string }[] = [];

const propertyCreate = vi.fn();
const propertyUpdate = vi.fn();
const propertyFindMany = vi.fn();
const propertyCount = vi.fn();
const auditLogCreate = vi.fn();
const importLogCreate = vi.fn();
const executeRawUnsafe = vi.fn();

/**
 * A FormData carrying a CSV file. jsdom's `File` does not implement `.text()`, so we
 * attach a working one — the action reads the upload via `file.text()`, and
 * `instanceof File` must still hold for the type/size checks.
 */
function csvForm(csvText: string): FormData {
  const file = new File([csvText], 'catalogue.csv', { type: 'text/csv' });
  Object.defineProperty(file, 'text', { value: async () => csvText });
  const fd = new FormData();
  fd.set('file', file);
  return fd;
}

/** The slugs actually written to the `property` rows, in insert order. */
function writtenSlugs(): string[] {
  return propertyCreate.mock.calls.map((call) => String(call[0].data['slug']));
}

/** The `property.created` audit rows the REAL insert path emitted, in insert order. */
function createdAuditRows(): Record<string, unknown>[] {
  return auditLogCreate.mock.calls
    .map((call) => call[0].data as Record<string, unknown>)
    .filter((row) => row['action'] === 'property.created');
}

beforeEach(() => {
  vi.clearAllMocks();
  requireStaffPermission.mockResolvedValue(undefined);
  getStaffActor.mockResolvedValue('agent:albert-aardvark');
  getStaffUserId.mockResolvedValue(USER_ID);
  getCurrentTenantId.mockResolvedValue(TENANT);
  getRequestIp.mockResolvedValue(IP);
  getRequestUserAgent.mockResolvedValue(USER_AGENT);
  isListingTypePermitted.mockResolvedValue(true);
  getTenantActiveListingQuota.mockResolvedValue(Infinity);

  existingSlugs = [];
  let nextId = 1;
  // Prisma's `create` echoes the row back; the real insert path reads `id` + `slug` off it.
  propertyCreate.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
    id: `p-${nextId++}`,
    slug: String(args.data['slug']),
  }));
  propertyUpdate.mockResolvedValue({});
  propertyFindMany.mockImplementation(async () => existingSlugs);
  propertyCount.mockResolvedValue(0);
  auditLogCreate.mockResolvedValue({});
  importLogCreate.mockResolvedValue({ id: LOG_ID });
  executeRawUnsafe.mockResolvedValue(0);

  withTenant.mockImplementation(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
    fn({
      property: {
        findFirst: vi.fn(),
        findMany: propertyFindMany,
        create: propertyCreate,
        update: propertyUpdate,
        count: propertyCount,
      },
      auditLog: { create: auditLogCreate },
      importLog: { create: importLogCreate },
      $executeRawUnsafe: executeRawUnsafe,
    }),
  );
});

describe('bulk import — REAL insertPropertyRow across multiple rows (FR-F-11 / FR-X-9)', () => {
  it('disambiguates rows of ONE run that derive the same base slug: base, base-2, base-3', async () => {
    const res = await importPropertiesFromCsv(
      { ok: false },
      csvForm(`${HEADER}\n${SAME_BASE_1}\n${SAME_BASE_2}\n${SAME_BASE_3}\n`),
    );

    expect(res.ok).toBe(true);
    expect(res.counts).toMatchObject({ input: 3, created: 3, failed: 0 });
    // The accumulation: `taken` is threaded across rows, so each successive row minting
    // the SAME base walks to the next free suffix. Were the set reset per row (or never
    // mutated), all three would be `BASE` and the run would violate @@unique(tenantId, slug).
    expect(writtenSlugs()).toEqual([BASE, `${BASE}-2`, `${BASE}-3`]);
  });

  it('every slug the run writes is unique (the @@unique([tenantId, slug]) invariant)', async () => {
    await importPropertiesFromCsv(
      { ok: false },
      csvForm(`${HEADER}\n${SAME_BASE_1}\n${SAME_BASE_2}\n${SAME_BASE_3}\n${OTHER_BASE}\n`),
    );
    const slugs = writtenSlugs();
    expect(slugs).toHaveLength(4);
    expect(new Set(slugs).size).toBe(4);
    // A row deriving a DIFFERENT base is untouched by the collision walk — it keeps its
    // own base rather than being dragged onto a suffix.
    expect(slugs[3]).toBe(OTHER);
  });

  it('walks PAST -2 when the tenant existing catalogue already holds the base and -2', async () => {
    // `taken` is seeded from the tenant's live slugs before the loop, so the run's FIRST
    // row already starts on the suffix loop — and the second walks one further.
    existingSlugs = [{ slug: BASE }, { slug: `${BASE}-2` }];
    const res = await importPropertiesFromCsv(
      { ok: false },
      csvForm(`${HEADER}\n${SAME_BASE_1}\n${SAME_BASE_2}\n`),
    );
    expect(res.ok).toBe(true);
    expect(writtenSlugs()).toEqual([`${BASE}-3`, `${BASE}-4`]);
  });

  it('emits ONE property.created audit row per created row, naming its OWN minted slug (G4)', async () => {
    await importPropertiesFromCsv(
      { ok: false },
      csvForm(`${HEADER}\n${SAME_BASE_1}\n${SAME_BASE_2}\n${SAME_BASE_3}\n`),
    );

    const rows = createdAuditRows();
    expect(rows).toHaveLength(3);
    // Each row is attributed to the property it created, not to the run.
    expect(rows.map((row) => row['entityId'])).toEqual(['p-1', 'p-2', 'p-3']);
    for (const row of rows) {
      expect(row).toMatchObject({
        tenantId: TENANT,
        actor: 'agent:albert-aardvark',
        action: 'property.created',
        entity: 'property',
        // FR-H-17 / FR-N-14 — the per-row audit carries the full request provenance.
        ip: IP,
        userAgent: USER_AGENT,
      });
    }
    // The diff records the DISAMBIGUATED slug the row was actually written with — so the
    // audit trail can be reconciled against the live URL.
    expect(rows.map((row) => (row['diff'] as { slug: string }).slug)).toEqual([
      BASE,
      `${BASE}-2`,
      `${BASE}-3`,
    ]);
    expect(rows.map((row) => (row['diff'] as { reference: string }).reference)).toEqual([
      'REF-001',
      'REF-002',
      'REF-003',
    ]);
  });

  it('audits the run ONCE (property.imported) alongside the per-row property.created rows', async () => {
    await importPropertiesFromCsv(
      { ok: false },
      csvForm(`${HEADER}\n${SAME_BASE_1}\n${SAME_BASE_2}\n`),
    );
    const actions = auditLogCreate.mock.calls.map(
      (call) => (call[0].data as { action: string }).action,
    );
    // Two per-row creations + exactly one run summary — the run event never replaces the
    // per-property events, and the per-property events never duplicate the run event.
    expect(actions.filter((a) => a === 'property.created')).toHaveLength(2);
    expect(actions.filter((a) => a === 'property.imported')).toHaveLength(1);
    expect(importLogCreate).toHaveBeenCalledTimes(1);
  });

  it('a row whose insert FAILS reserves no slug — the next colliding row takes the free one', async () => {
    // FR-X-5: the failed row rolls back to its savepoint, so its slug was never claimed.
    // The real insert reserves the slug only AFTER the row + its audit row are written.
    const duplicate = new Error('Unique constraint failed');
    (duplicate as Error & { code: string }).code = 'P2002';
    propertyCreate.mockRejectedValueOnce(duplicate);

    const res = await importPropertiesFromCsv(
      { ok: false },
      csvForm(`${HEADER}\n${SAME_BASE_1}\n${SAME_BASE_2}\n`),
    );

    expect(res.ok).toBe(true);
    expect(res.counts).toMatchObject({ input: 2, created: 1, failed: 1 });
    // Row 2 mints the BARE base — not `base-2` — because row 1's insert was rolled back.
    expect(writtenSlugs()).toEqual([BASE, BASE]);
    // Only the surviving row is audited as created; the rolled-back row's audit row went
    // with its savepoint, and it gets a property.import_row_failed entry instead.
    expect(createdAuditRows()).toHaveLength(1);
    const actions = auditLogCreate.mock.calls.map(
      (call) => (call[0].data as { action: string }).action,
    );
    expect(actions.filter((a) => a === 'property.import_row_failed')).toHaveLength(1);
  });

  it('an invalid row is isolated and does NOT consume a slug suffix from the valid rows', async () => {
    const BAD = 'REF-BAD,residential,sale,Flat 4 Acacia House,,Acacia House,Chorlton'; // no postcode
    const res = await importPropertiesFromCsv(
      { ok: false },
      csvForm(`${HEADER}\n${SAME_BASE_1}\n${BAD}\n${SAME_BASE_2}\n`),
    );
    expect(res.ok).toBe(true);
    expect(res.counts).toMatchObject({ input: 3, created: 2, failed: 1 });
    // The rejected row never reached the insert path, so the two valid rows still take
    // the first two suffixes — the numbering is not gapped by a row that never existed.
    expect(writtenSlugs()).toEqual([BASE, `${BASE}-2`]);
  });
});
