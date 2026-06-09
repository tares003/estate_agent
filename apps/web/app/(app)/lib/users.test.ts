// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { listUsers, type UserListReader, type UserRow } from './users.js';

function row(over: Partial<UserRow> = {}): UserRow {
  return { id: 'u1', name: 'Ana Agent', email: 'ana@agency.test', role: 'sales_agent', ...over };
}

function reader(rows: UserRow[]): { db: UserListReader; calls: { findMany: unknown[] } } {
  const calls = { findMany: [] as unknown[] };
  const db: UserListReader = {
    user: {
      findMany: vi.fn(async (args) => {
        calls.findMany.push(args);
        return rows;
      }),
      count: vi.fn(async () => rows.length),
    },
  };
  return { db, calls };
}

describe('listUsers', () => {
  it('returns the staff name-ordered with pagination totals', async () => {
    const { db, calls } = reader([row({ id: 'a' }), row({ id: 'b' })]);
    const result = await listUsers(db, { pageSize: 20 });
    expect(result.items.map((u) => u.id)).toEqual(['a', 'b']);
    expect(result).toMatchObject({ total: 2, page: 1, pageSize: 20, totalPages: 1 });
    expect(calls.findMany[0]).toMatchObject({ orderBy: { name: 'asc' } });
  });

  it('applies skip/take and clamps pageSize to 60', async () => {
    const { db, calls } = reader([]);
    await listUsers(db, { page: 2, pageSize: 500 });
    expect(calls.findMany[0]).toMatchObject({ skip: 60, take: 60 });
  });
});
