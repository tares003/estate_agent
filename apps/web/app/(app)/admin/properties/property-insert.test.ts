import { describe, expect, it, vi } from 'vitest';
import { propertyCreateSchema } from '@estate/validators';

import { disambiguateSlug, insertPropertyRow, updatePropertyRow } from './property-insert.js';

// EPIC-X FR-X-4 — the SHARED property write paths the bulk import drives. Unit-level,
// with a fake tx: `insertPropertyRow` (already exercised end-to-end through the create
// action) must persist the imported record's `externalId` so a later upsert can match
// on it; `updatePropertyRow` is the upsert's update half — it rewrites the matched
// row's imported columns through the SAME `coreData` mapping as create (pounds → pence
// etc.), stamps `updatedByUserId`, leaves the row's slug/provenance alone (URL
// stability — slug changes belong to the admin edit flow with its FR-F-5 redirect),
// and emits a `property.updated` audit row on the same transaction (G4).
//
// FR-F-4 / FR-F-11 — PLUS the slug-disambiguation contract both write paths rest on
// (audit finding import-insertpropertyrow-overmock-batch-gap). Two layers, because the
// admin create/update actions only ever exercise ONE collision (`base` → `base-2`):
//
//   1. `disambiguateSlug` directly — the SUFFIX LOOP past 2 (`base-3`, `base-4`, …),
//      gap-filling and purity, none of which a single-collision test can reach.
//   2. `insertPropertyRow` across SUCCESSIVE calls threading ONE `taken` set — the
//      in-run accumulation a batch depends on: each minted slug is reserved, so the
//      next row minting the same base walks to the next free suffix. If the `taken`
//      set stopped being threaded (or stopped being mutated), these rows would all
//      mint the same slug and the DB's @@unique([tenantId, slug]) would abort the run.
//
// The end-to-end proof — a real multi-row import through the real insert path — lives
// in import/slug-collision.test.ts.

const CTX = {
  tenantId: '00000000-0000-0000-0000-000000000001',
  actor: 'agent:albert-aardvark',
  createdByUserId: '22222222-2222-2222-2222-222222222222',
  ip: '203.0.113.7',
};

/** A validated import row (the same shape the CSV core hands the action). */
function input(overrides: Record<string, unknown> = {}) {
  return propertyCreateSchema.parse({
    reference: 'REF-001',
    listingType: 'residential',
    saleType: 'sale',
    displayAddress: '12 Acacia Ave',
    postcode: 'M21 9WN',
    title: 'Flat One',
    price: 350000,
    ...overrides,
  });
}

/** A fake tx capturing the property + audit writes. */
function fakeTx() {
  const propertyCreate = vi.fn(async (args: { data: Record<string, unknown> }) => ({
    id: 'p-new',
    slug: String(args.data['slug']),
  }));
  const propertyUpdate = vi.fn(
    async (_args: { where: Record<string, unknown>; data: Record<string, unknown> }) => ({}),
  );
  const auditCreate = vi.fn(async (_args: { data: Record<string, unknown> }) => ({}));
  return {
    tx: {
      property: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: propertyCreate,
        update: propertyUpdate,
      },
      auditLog: { create: auditCreate },
    },
    propertyCreate,
    propertyUpdate,
    auditCreate,
  };
}

describe('insertPropertyRow — externalId (FR-X-4)', () => {
  it('persists the imported externalId so a later upsert can match on it', async () => {
    const { tx, propertyCreate } = fakeTx();
    await insertPropertyRow(tx, CTX, input({ externalId: 'EXT-100' }), new Set());
    const data = propertyCreate.mock.calls[0]![0].data;
    expect(data['externalId']).toBe('EXT-100');
  });

  it('leaves externalId unset when the row carries none', async () => {
    const { tx, propertyCreate } = fakeTx();
    await insertPropertyRow(tx, CTX, input(), new Set());
    const data = propertyCreate.mock.calls[0]![0].data;
    expect('externalId' in data).toBe(false);
  });
});

// §F specification — "Internal size in square feet and square metres". Square feet is the
// CAPTURED unit; the admin editor shows "size (sqft + auto-converted sqm)", so the write
// path derives the square-metre column rather than asking for it twice.
describe('coreData — internal size (§F specification)', () => {
  it('persists internalSqft and the auto-converted internalSqm on create', async () => {
    const { tx, propertyCreate } = fakeTx();
    await insertPropertyRow(tx, CTX, input({ internalSqft: 1450 }), new Set());
    const data = propertyCreate.mock.calls[0]![0].data;
    expect(data['internalSqft']).toBe(1450);
    expect(data['internalSqm']).toBe(135); // 1450 × 0.09290304 = 134.7 → 135
  });

  it('writes neither size column when the listing carries no measured size', async () => {
    const { tx, propertyCreate } = fakeTx();
    await insertPropertyRow(tx, CTX, input(), new Set());
    const data = propertyCreate.mock.calls[0]![0].data;
    expect('internalSqft' in data).toBe(false);
    expect('internalSqm' in data).toBe(false);
  });

  it('carries the size through the import upsert update path too', async () => {
    const { tx, propertyUpdate } = fakeTx();
    await updatePropertyRow(tx, CTX, input({ internalSqft: 900 }), { id: 'p-1' }, 'reference');
    const data = propertyUpdate.mock.calls[0]![0].data;
    expect(data['internalSqft']).toBe(900);
    expect(data['internalSqm']).toBe(84); // 900 × 0.09290304 = 83.6 → 84
  });
});

// FR-F-4 / FR-F-11 — the pure slug-disambiguation helper. The create/update actions only
// ever drive it through a SINGLE collision (`base` → `base-2`), so its suffix LOOP —
// the `base-3`, `base-4`, … walk a batch import relies on — was previously untested.
describe('disambiguateSlug (FR-F-4 / FR-F-11)', () => {
  const BASE = 'flat-one-m21';

  it('returns the base slug untouched when nothing has claimed it', () => {
    expect(disambiguateSlug(BASE, new Set())).toBe(BASE);
    expect(disambiguateSlug(BASE, new Set(['some-other-slug']))).toBe(BASE);
  });

  it('appends -2 on the first collision', () => {
    expect(disambiguateSlug(BASE, new Set([BASE]))).toBe(`${BASE}-2`);
  });

  it('walks past -2 to -3 when the base AND -2 are both taken', () => {
    expect(disambiguateSlug(BASE, new Set([BASE, `${BASE}-2`]))).toBe(`${BASE}-3`);
  });

  it('keeps walking the suffix loop until it reaches a free slug', () => {
    // The accumulation a batch of five rows sharing one base slug produces: each
    // successive call sees one more claimed suffix and must mint the next.
    const taken = new Set([BASE, `${BASE}-2`, `${BASE}-3`, `${BASE}-4`]);
    expect(disambiguateSlug(BASE, taken)).toBe(`${BASE}-5`);
    taken.add(`${BASE}-5`);
    expect(disambiguateSlug(BASE, taken)).toBe(`${BASE}-6`);
  });

  it('takes the FIRST free suffix, filling a gap left by a released slug', () => {
    // -2 is free (its listing was deleted) while -3 is live: the loop must stop at the
    // first free candidate rather than counting the set's size.
    expect(disambiguateSlug(BASE, new Set([BASE, `${BASE}-3`]))).toBe(`${BASE}-2`);
  });

  it('is deterministic and pure — the same inputs give the same slug, `taken` is not mutated', () => {
    const taken = new Set([BASE, `${BASE}-2`]);
    expect(disambiguateSlug(BASE, taken)).toBe(`${BASE}-3`);
    expect(disambiguateSlug(BASE, taken)).toBe(`${BASE}-3`);
    expect([...taken]).toEqual([BASE, `${BASE}-2`]);
  });

  it('disambiguates each base independently', () => {
    const taken = new Set([BASE, `${BASE}-2`]);
    expect(disambiguateSlug('other-base', taken)).toBe('other-base');
  });
});

// FR-F-11 — the IN-RUN accumulation a bulk import depends on: `insertPropertyRow`
// reserves every slug it mints in the caller's `taken` set, so successive rows of ONE
// run that derive the SAME base slug walk `base` → `base-2` → `base-3`. The admin create
// action inserts one row per transaction and can never exercise this; the import suites
// mock `insertPropertyRow` out entirely (documented over-mock), so nothing drove it.
describe('insertPropertyRow — in-run slug accumulation (FR-F-11)', () => {
  /** Three rows an agency would realistically upload: same building, same town. */
  const BASE = 'flat-one-m21'; // slugify(title) + postcode prefix; no town on the fixture

  it('mints base, base-2, base-3 for successive rows deriving the SAME base slug', async () => {
    const { tx, propertyCreate } = fakeTx();
    const taken = new Set<string>();

    const first = await insertPropertyRow(tx, CTX, input({ reference: 'REF-001' }), taken);
    const second = await insertPropertyRow(tx, CTX, input({ reference: 'REF-002' }), taken);
    const third = await insertPropertyRow(tx, CTX, input({ reference: 'REF-003' }), taken);

    expect([first.slug, second.slug, third.slug]).toEqual([BASE, `${BASE}-2`, `${BASE}-3`]);
    // The slug actually WRITTEN to each row matches what was returned (the column, not
    // just the return value, carries the disambiguated slug).
    const written = propertyCreate.mock.calls.map((call) => call[0].data['slug']);
    expect(written).toEqual([BASE, `${BASE}-2`, `${BASE}-3`]);
    // The @@unique([tenantId, slug]) invariant the run would otherwise violate.
    expect(new Set(written).size).toBe(3);
  });

  it('reserves each minted slug in the caller-supplied `taken` set', async () => {
    const { tx } = fakeTx();
    const taken = new Set<string>();
    await insertPropertyRow(tx, CTX, input({ reference: 'REF-001' }), taken);
    expect(taken.has(BASE)).toBe(true);
    await insertPropertyRow(tx, CTX, input({ reference: 'REF-002' }), taken);
    expect(taken.has(`${BASE}-2`)).toBe(true);
  });

  it('disambiguates the FIRST row against the tenant existing slugs seeded into `taken`', async () => {
    const { tx } = fakeTx();
    // The import seeds `taken` from the tenant's live catalogue before the loop.
    const taken = new Set([BASE, `${BASE}-2`]);
    const first = await insertPropertyRow(tx, CTX, input({ reference: 'REF-001' }), taken);
    const second = await insertPropertyRow(tx, CTX, input({ reference: 'REF-002' }), taken);
    expect([first.slug, second.slug]).toEqual([`${BASE}-3`, `${BASE}-4`]);
  });

  it('disambiguates an EXPLICIT submitted slug the same way as a derived one', async () => {
    const { tx } = fakeTx();
    const taken = new Set<string>();
    // Two CSV rows carrying the same `slug` column value (it is an import column).
    const first = await insertPropertyRow(tx, CTX, input({ slug: 'penthouse' }), taken);
    const second = await insertPropertyRow(
      tx,
      CTX,
      input({ reference: 'REF-002', slug: 'penthouse' }),
      taken,
    );
    expect([first.slug, second.slug]).toEqual(['penthouse', 'penthouse-2']);
  });

  it('emits ONE property.created audit row per inserted row, each naming its minted slug (G4)', async () => {
    const { tx, auditCreate } = fakeTx();
    const taken = new Set<string>();
    await insertPropertyRow(tx, CTX, input({ reference: 'REF-001' }), taken);
    await insertPropertyRow(tx, CTX, input({ reference: 'REF-002' }), taken);

    expect(auditCreate).toHaveBeenCalledTimes(2);
    const rows = auditCreate.mock.calls.map((call) => call[0].data);
    for (const row of rows) {
      expect(row).toMatchObject({
        tenantId: CTX.tenantId,
        actor: CTX.actor,
        action: 'property.created',
        entity: 'property',
        ip: CTX.ip,
      });
    }
    expect(rows[0]!['diff']).toMatchObject({ reference: 'REF-001', slug: BASE });
    expect(rows[1]!['diff']).toMatchObject({ reference: 'REF-002', slug: `${BASE}-2` });
  });

  it('a failed insert reserves NOTHING — the next row minting that base takes it', async () => {
    // The slug is only reserved AFTER the row + its audit row are written, so a row the
    // import rolls back to its savepoint (e.g. a duplicate reference, P2002) leaves no
    // phantom claim behind: the next row minting the same base gets the bare base slug.
    const { tx, propertyCreate } = fakeTx();
    const taken = new Set<string>();
    propertyCreate.mockRejectedValueOnce(new Error('unique constraint failed'));

    await expect(
      insertPropertyRow(tx, CTX, input({ reference: 'REF-001' }), taken),
    ).rejects.toThrow(/unique constraint/);
    expect(taken.size).toBe(0);

    const next = await insertPropertyRow(tx, CTX, input({ reference: 'REF-002' }), taken);
    expect(next.slug).toBe(BASE);
  });
});

describe('updatePropertyRow (FR-X-4)', () => {
  it('updates the matched row by id with the imported columns (price in pence)', async () => {
    const { tx, propertyUpdate } = fakeTx();
    await updatePropertyRow(tx, CTX, input(), { id: 'p-1' }, 'reference');
    expect(propertyUpdate).toHaveBeenCalledTimes(1);
    const args = propertyUpdate.mock.calls[0]![0];
    expect(args.where).toEqual({ id: 'p-1' });
    expect(args.data).toMatchObject({
      reference: 'REF-001',
      listingType: 'residential',
      saleType: 'sale',
      displayAddress: '12 Acacia Ave',
      postcode: 'M21 9WN',
      title: 'Flat One',
      price: 35000000, // pounds → pence, the same coreData mapping as create
      updatedByUserId: CTX.createdByUserId,
    });
  });

  it('never rewrites the slug or the creation provenance (URL stability)', async () => {
    const { tx, propertyUpdate } = fakeTx();
    await updatePropertyRow(tx, CTX, input({ slug: 'new-slug' }), { id: 'p-1' }, 'reference');
    const data = propertyUpdate.mock.calls[0]![0].data;
    expect('slug' in data).toBe(false);
    expect('createdByUserId' in data).toBe(false);
    expect('tenantId' in data).toBe(false);
    expect('publishedAt' in data).toBe(false);
  });

  it('writes the externalId when the row carries one, leaves it untouched otherwise', async () => {
    const { tx, propertyUpdate } = fakeTx();
    await updatePropertyRow(tx, CTX, input({ externalId: 'EXT-9' }), { id: 'p-1' }, 'reference');
    await updatePropertyRow(tx, CTX, input(), { id: 'p-1' }, 'reference');
    const first = propertyUpdate.mock.calls[0]![0].data;
    const second = propertyUpdate.mock.calls[1]![0].data;
    expect(first['externalId']).toBe('EXT-9');
    expect('externalId' in second).toBe(false);
  });

  it('emits a property.updated audit row against the matched property (G4)', async () => {
    const { tx, auditCreate } = fakeTx();
    await updatePropertyRow(tx, CTX, input(), { id: 'p-1' }, 'externalId');
    expect(auditCreate).toHaveBeenCalledTimes(1);
    const written = auditCreate.mock.calls[0]![0].data;
    expect(written).toMatchObject({
      tenantId: CTX.tenantId,
      actor: CTX.actor,
      action: 'property.updated',
      entity: 'property',
      entityId: 'p-1',
      ip: CTX.ip,
    });
    expect(written['diff']).toMatchObject({ reference: 'REF-001', matchedOn: 'externalId' });
  });
});
