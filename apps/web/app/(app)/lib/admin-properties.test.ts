// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import {
  buildAdminPropertyWhere,
  getAdminProperty,
  listAdminProperties,
  type AdminPropertyDetail,
  type AdminPropertyDetailReader,
  type AdminPropertyReader,
  type AdminPropertyRow,
} from './admin-properties.js';

function row(over: Partial<AdminPropertyRow> = {}): AdminPropertyRow {
  return {
    id: 'p1',
    title: 'Edwardian semi',
    displayAddress: 'Palatine Road, Didsbury',
    saleType: 'sale',
    marketStatus: 'for_sale',
    price: 52_500_000,
    publishedAt: new Date('2026-06-01T00:00:00.000Z'),
    ...over,
  };
}

describe('buildAdminPropertyWhere', () => {
  it('includes drafts (no published filter) but hides soft-deleted listings', () => {
    expect(buildAdminPropertyWhere()).toEqual({ deletedAt: null });
  });
});

function reader(rows: AdminPropertyRow[]): {
  db: AdminPropertyReader;
  calls: { findMany: unknown[] };
} {
  const calls = { findMany: [] as unknown[] };
  const db: AdminPropertyReader = {
    property: {
      findMany: vi.fn(async (args) => {
        calls.findMany.push(args);
        return rows;
      }),
      count: vi.fn(async () => rows.length),
    },
  };
  return { db, calls };
}

describe('listAdminProperties', () => {
  it('returns listings newest-first with pagination totals', async () => {
    const { db, calls } = reader([row({ id: 'a' }), row({ id: 'b' })]);
    const result = await listAdminProperties(db, { pageSize: 20 });
    expect(result.items.map((p) => p.id)).toEqual(['a', 'b']);
    expect(result).toMatchObject({ total: 2, page: 1, pageSize: 20, totalPages: 1 });
    expect(calls.findMany[0]).toMatchObject({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('applies skip/take and clamps pageSize to 60', async () => {
    const { db, calls } = reader([]);
    await listAdminProperties(db, { page: 2, pageSize: 500 });
    expect(calls.findMany[0]).toMatchObject({ skip: 60, take: 60 });
  });
});

describe('getAdminProperty', () => {
  function detail(over: Partial<AdminPropertyDetail> = {}): AdminPropertyDetail {
    return {
      id: 'p1',
      title: 'Edwardian semi',
      displayAddress: 'Palatine Road, Didsbury',
      postcode: 'M20 6RE',
      saleType: 'sale',
      marketStatus: 'for_sale',
      price: 52_500_000,
      bedrooms: 4,
      bathrooms: 2,
      receptions: 2,
      description: 'A handsome semi.',
      publishedAt: null,
      ...over,
    };
  }

  function reader(result: AdminPropertyDetail | null): {
    db: AdminPropertyDetailReader;
    calls: unknown[];
  } {
    const calls: unknown[] = [];
    const db: AdminPropertyDetailReader = {
      property: {
        findFirst: vi.fn(async (args) => {
          calls.push(args);
          return result;
        }),
      },
    };
    return { db, calls };
  }

  it('loads a listing by id, drafts included, soft-deleted excluded', async () => {
    const { db, calls } = reader(detail());
    const result = await getAdminProperty(db, 'p1');
    expect(result?.id).toBe('p1');
    expect(calls[0]).toEqual({ where: { id: 'p1', deletedAt: null } });
  });

  it('returns null when there is no such listing', async () => {
    const { db } = reader(null);
    expect(await getAdminProperty(db, 'missing')).toBeNull();
  });
});
