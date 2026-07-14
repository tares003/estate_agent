import { describe, expect, it, vi } from 'vitest';
import { propertyCreateSchema } from '@estate/validators';

import { insertPropertyRow, updatePropertyRow } from './property-insert.js';

// EPIC-X FR-X-4 — the SHARED property write paths the bulk import drives. Unit-level,
// with a fake tx: `insertPropertyRow` (already exercised end-to-end through the create
// action) must persist the imported record's `externalId` so a later upsert can match
// on it; `updatePropertyRow` is the upsert's update half — it rewrites the matched
// row's imported columns through the SAME `coreData` mapping as create (pounds → pence
// etc.), stamps `updatedByUserId`, leaves the row's slug/provenance alone (URL
// stability — slug changes belong to the admin edit flow with its FR-F-5 redirect),
// and emits a `property.updated` audit row on the same transaction (G4).

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
