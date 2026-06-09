// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import {
  buildContactWhere,
  listContacts,
  type ContactListReader,
  type ContactRow,
} from './contacts.js';

function row(over: Partial<ContactRow> = {}): ContactRow {
  return {
    id: 'c1',
    name: 'Sam Buyer',
    email: 'sam@example.com',
    phone: null,
    type: 'buyer',
    createdAt: new Date(1_000_000_000_000),
    ...over,
  };
}

describe('buildContactWhere', () => {
  it('hides soft-deleted contacts by default', () => {
    expect(buildContactWhere({})).toEqual({ deletedAt: null });
  });

  it('filters to a single type when given', () => {
    expect(buildContactWhere({ type: 'vendor' })).toEqual({ deletedAt: null, type: 'vendor' });
  });
});

function reader(rows: ContactRow[]): { db: ContactListReader; calls: { findMany: unknown[] } } {
  const calls = { findMany: [] as unknown[] };
  const db: ContactListReader = {
    contact: {
      findMany: vi.fn(async (args) => {
        calls.findMany.push(args);
        return rows;
      }),
      count: vi.fn(async () => rows.length),
    },
  };
  return { db, calls };
}

describe('listContacts', () => {
  it('returns the contacts newest-first with pagination totals', async () => {
    const { db, calls } = reader([row({ id: 'a' }), row({ id: 'b' })]);
    const result = await listContacts(db, { pageSize: 20 });
    expect(result.items.map((c) => c.id)).toEqual(['a', 'b']);
    expect(result).toMatchObject({ total: 2, page: 1, pageSize: 20, totalPages: 1 });
    expect(calls.findMany[0]).toMatchObject({ orderBy: { createdAt: 'desc' } });
  });

  it('applies the type filter, skip/take, and clamps pageSize to 60', async () => {
    const { db, calls } = reader([]);
    await listContacts(db, { type: 'landlord', page: 2, pageSize: 500 });
    expect(calls.findMany[0]).toMatchObject({
      where: { deletedAt: null, type: 'landlord' },
      skip: 60,
      take: 60,
    });
  });
});
