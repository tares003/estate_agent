// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import {
  buildAdminPropertyWhere,
  listAdminProperties,
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
