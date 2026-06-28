// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { listSavedSearches, type SavedSearchReader } from './saved-searches.js';

// EPIC-T FR-T-8 — the saved-searches read model. Pure query-shaping over a
// STRUCTURAL Prisma client (DB-free to unit-test, mirrors saved-properties.ts); the
// live query runs tenant-scoped (RLS) + user-scoped via withTenant in the account
// route. Newest-first.

const USER = 'c1';

function reader(rows: unknown[]): {
  r: SavedSearchReader;
  findMany: ReturnType<typeof vi.fn>;
} {
  const findMany = vi.fn(async () => rows);
  return {
    r: { savedSearch: { findMany } } as unknown as SavedSearchReader,
    findMany,
  };
}

describe('listSavedSearches', () => {
  it('returns the customer saved searches newest-first, scoped to the user', async () => {
    const { r, findMany } = reader([
      {
        id: 's2',
        name: 'Recent',
        filters: { location: 'Didsbury', bedroomsMin: 2, sort: 'newest', page: 1, unit: 'mi' },
        alertFrequency: 'daily',
        createdAt: new Date('2026-06-02T00:00:00Z'),
      },
      {
        id: 's1',
        name: 'Older',
        filters: { saleType: 'rent', sort: 'newest', page: 1, unit: 'mi' },
        alertFrequency: 'off',
        createdAt: new Date('2026-06-01T00:00:00Z'),
      },
    ]);

    const result = await listSavedSearches(r, USER);

    expect(result.map((row) => row.id)).toEqual(['s2', 's1']);
    expect(result[0]!.name).toBe('Recent');
    expect(result[0]!.alertFrequency).toBe('daily');
    expect(result[0]!.filters.location).toBe('Didsbury');
    // Scopes the read to the user and orders newest-first.
    expect(findMany.mock.calls[0]![0]).toMatchObject({
      where: { userId: USER },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('returns an empty list when the customer has saved no searches', async () => {
    const { r } = reader([]);
    expect(await listSavedSearches(r, USER)).toEqual([]);
  });

  it('coerces a null/absent filters payload to an empty filter object', async () => {
    const { r } = reader([
      {
        id: 's1',
        name: 'No filters',
        filters: null,
        alertFrequency: 'weekly',
        createdAt: new Date('2026-06-01T00:00:00Z'),
      },
    ]);
    const result = await listSavedSearches(r, USER);
    expect(result[0]!.filters).toEqual({});
  });
});
