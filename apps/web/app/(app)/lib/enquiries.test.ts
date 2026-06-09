// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import {
  buildEnquiryWhere,
  listEnquiries,
  toQueueItem,
  type EnquiryListReader,
  type EnquiryRow,
} from './enquiries.js';

// EPIC-I CRM read model: the enquiry queue. DB-free (a structural client), mirrors
// app/(app)/lib/properties.ts. The live query runs tenant-scoped via withTenant.

const HOUR = 3_600_000;
const NOW = 1_000_000_000_000;

function row(over: Partial<EnquiryRow> = {}): EnquiryRow {
  return {
    id: 'e1',
    name: 'Sam Buyer',
    email: 'sam@example.com',
    status: 'new',
    propertyId: null,
    createdAt: new Date(NOW),
    updatedAt: new Date(NOW),
    ...over,
  };
}

describe('toQueueItem ageBand (H.6)', () => {
  it('is green within 4h, amber within 24h, red beyond 24h', () => {
    expect(toQueueItem(row({ createdAt: new Date(NOW - 1 * HOUR) }), NOW).ageBand).toBe('green');
    expect(toQueueItem(row({ createdAt: new Date(NOW - 10 * HOUR) }), NOW).ageBand).toBe('amber');
    expect(toQueueItem(row({ createdAt: new Date(NOW - 48 * HOUR) }), NOW).ageBand).toBe('red');
  });

  it('projects only the canonical queue fields', () => {
    expect(toQueueItem(row(), NOW)).toEqual({
      id: 'e1',
      name: 'Sam Buyer',
      email: 'sam@example.com',
      status: 'new',
      propertyId: null,
      ageBand: 'green',
    });
  });
});

describe('buildEnquiryWhere', () => {
  it('excludes archived by default (the open-work view)', () => {
    expect(buildEnquiryWhere({})).toEqual({ status: { not: 'archived' } });
  });

  it('filters to a single status when given (overriding the default)', () => {
    expect(buildEnquiryWhere({ status: 'new' })).toEqual({ status: 'new' });
  });
});

function reader(rows: EnquiryRow[]): {
  db: EnquiryListReader;
  calls: { findMany: unknown[]; count: unknown[] };
} {
  const calls = { findMany: [] as unknown[], count: [] as unknown[] };
  const db: EnquiryListReader = {
    enquiry: {
      findMany: vi.fn(async (args) => {
        calls.findMany.push(args);
        return rows;
      }),
      count: vi.fn(async (args) => {
        calls.count.push(args);
        return rows.length;
      }),
    },
  };
  return { db, calls };
}

describe('listEnquiries', () => {
  it('maps rows to queue items and returns pagination totals', async () => {
    const { db } = reader([row({ id: 'a' }), row({ id: 'b' })]);
    const result = await listEnquiries(db, { pageSize: 20 }, NOW);
    expect(result.items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(result).toMatchObject({ total: 2, page: 1, pageSize: 20, totalPages: 1 });
  });

  it('uses the same where for findMany and count, and applies skip/take', async () => {
    const { db, calls } = reader([]);
    await listEnquiries(db, { status: 'new', page: 3, pageSize: 10 }, NOW);
    expect((calls.findMany[0] as { where: unknown }).where).toEqual({ status: 'new' });
    expect((calls.count[0] as { where: unknown }).where).toEqual({ status: 'new' });
    expect(calls.findMany[0]).toMatchObject({ skip: 20, take: 10 });
  });

  it('clamps pageSize to 1..60 and sorts newest-first by default', async () => {
    const { db, calls } = reader([]);
    await listEnquiries(db, { pageSize: 500 }, NOW);
    expect(calls.findMany[0]).toMatchObject({ take: 60, orderBy: { createdAt: 'desc' } });
  });

  it('supports oldest sort', async () => {
    const { db, calls } = reader([]);
    await listEnquiries(db, { sort: 'oldest' }, NOW);
    expect(calls.findMany[0]).toMatchObject({ orderBy: { createdAt: 'asc' } });
  });
});
