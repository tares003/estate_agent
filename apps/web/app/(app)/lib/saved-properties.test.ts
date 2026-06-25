// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import {
  listSavedProperties,
  savedPropertyIdsFor,
  type SavedPropertyReader,
} from './saved-properties.js';

// EPIC-T FR-T-5/6 — the saved-properties read model. Pure query-shaping over a
// STRUCTURAL Prisma client (DB-free to unit-test, mirrors users.ts); the live
// queries run tenant-scoped (RLS) + user-scoped via withTenant in the account
// route. Newest-saved-first.

function reader(
  savedRows: Array<{ propertyId: string }>,
  properties: Array<{ id: string; slug: string }> = [],
): {
  r: SavedPropertyReader;
  savedFindMany: ReturnType<typeof vi.fn>;
  propertyFindMany: ReturnType<typeof vi.fn>;
} {
  const savedFindMany = vi.fn(async () => savedRows);
  const propertyFindMany = vi.fn(async () => properties);
  return {
    r: {
      savedProperty: { findMany: savedFindMany },
      property: { findMany: propertyFindMany },
    } as unknown as SavedPropertyReader,
    savedFindMany,
    propertyFindMany,
  };
}

const USER = 'c1';

describe('savedPropertyIdsFor', () => {
  it('returns the set of property ids the user has saved', async () => {
    const { r, savedFindMany } = reader([{ propertyId: 'p1' }, { propertyId: 'p2' }]);
    const ids = await savedPropertyIdsFor(r, USER, ['p1', 'p2', 'p3']);
    expect(ids).toEqual(new Set(['p1', 'p2']));
    // Scopes the read to the current user AND the candidate property ids.
    expect(savedFindMany.mock.calls[0]![0]).toMatchObject({
      where: { userId: USER, propertyId: { in: ['p1', 'p2', 'p3'] } },
    });
  });

  it('returns an empty set when no candidates are supplied (no query)', async () => {
    const { r, savedFindMany } = reader([]);
    expect(await savedPropertyIdsFor(r, USER, [])).toEqual(new Set());
    expect(savedFindMany).not.toHaveBeenCalled();
  });
});

describe('listSavedProperties', () => {
  it('returns the saved properties newest-first with the saved property ids', async () => {
    const { r, savedFindMany, propertyFindMany } = reader(
      [{ propertyId: 'p2' }, { propertyId: 'p1' }],
      [
        {
          id: 'p1',
          slug: 'one',
          displayAddress: '1 Road',
          postcode: 'M1 1AA',
          title: 'One',
          saleType: 'sale',
          marketStatus: 'for_sale',
          price: 25000000,
          bedrooms: 3,
          bathrooms: 1,
          receptions: 1,
        },
        {
          id: 'p2',
          slug: 'two',
          displayAddress: '2 Road',
          postcode: 'M2 2BB',
          title: 'Two',
          saleType: 'rent',
          marketStatus: 'to_rent',
          price: 120000,
          bedrooms: 2,
          bathrooms: 1,
          receptions: 1,
        },
      ] as never,
    );

    const result = await listSavedProperties(r, USER);

    // Saved rows are ordered newest-first by the DB; the join preserves that order.
    expect(result.items.map((item) => item.id)).toEqual(['p2', 'p1']);
    expect(result.savedIds).toEqual(new Set(['p1', 'p2']));
    expect(savedFindMany.mock.calls[0]![0]).toMatchObject({
      where: { userId: USER },
      orderBy: { createdAt: 'desc' },
    });
    expect(propertyFindMany).toHaveBeenCalledTimes(1);
  });

  it('returns an empty result when the user has saved nothing (no property query)', async () => {
    const { r, propertyFindMany } = reader([]);
    const result = await listSavedProperties(r, USER);
    expect(result.items).toEqual([]);
    expect(result.savedIds).toEqual(new Set());
    expect(propertyFindMany).not.toHaveBeenCalled();
  });

  it('drops a saved row whose property is no longer visible (unpublished / removed)', async () => {
    const { r } = reader([{ propertyId: 'p1' }, { propertyId: 'gone' }], [
      {
        id: 'p1',
        slug: 'one',
        displayAddress: '1 Road',
        postcode: 'M1 1AA',
        title: 'One',
        saleType: 'sale',
        marketStatus: 'for_sale',
        price: 25000000,
        bedrooms: 3,
        bathrooms: 1,
        receptions: 1,
      },
    ] as never);
    const result = await listSavedProperties(r, USER);
    expect(result.items.map((item) => item.id)).toEqual(['p1']);
  });
});
