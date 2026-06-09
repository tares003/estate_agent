// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import {
  buildAuditWhere,
  listAuditLogs,
  type AuditLogReader,
  type AuditLogRow,
} from './audit-log.js';

function row(over: Partial<AuditLogRow> = {}): AuditLogRow {
  return {
    id: 'a1',
    actor: 'agent:dev-staff',
    action: 'enquiry.status_changed',
    entity: 'enquiry',
    entityId: 'e1',
    diff: { status: { from: 'new', to: 'contacted' } },
    ip: '203.0.113.7',
    userAgent: null,
    createdAt: new Date(1_000_000_000_000),
    ...over,
  };
}

describe('buildAuditWhere', () => {
  it('is unfiltered by default', () => {
    expect(buildAuditWhere({})).toEqual({});
  });

  it('filters by entity when given', () => {
    expect(buildAuditWhere({ entity: 'enquiry' })).toEqual({ entity: 'enquiry' });
  });
});

function reader(rows: AuditLogRow[]): { db: AuditLogReader; calls: { findMany: unknown[] } } {
  const calls = { findMany: [] as unknown[] };
  const db: AuditLogReader = {
    auditLog: {
      findMany: vi.fn(async (args) => {
        calls.findMany.push(args);
        return rows;
      }),
      count: vi.fn(async () => rows.length),
    },
  };
  return { db, calls };
}

describe('listAuditLogs', () => {
  it('returns entries newest-first with pagination totals', async () => {
    const { db, calls } = reader([row({ id: 'a' }), row({ id: 'b' })]);
    const result = await listAuditLogs(db, { pageSize: 20 });
    expect(result.items.map((r) => r.id)).toEqual(['a', 'b']);
    expect(result).toMatchObject({ total: 2, page: 1, pageSize: 20, totalPages: 1 });
    expect(calls.findMany[0]).toMatchObject({ orderBy: { createdAt: 'desc' } });
  });

  it('applies the entity filter, skip/take, and clamps pageSize to 100', async () => {
    const { db, calls } = reader([]);
    await listAuditLogs(db, { entity: 'enquiry', page: 2, pageSize: 500 });
    expect(calls.findMany[0]).toMatchObject({
      where: { entity: 'enquiry' },
      skip: 100,
      take: 100,
    });
  });
});
