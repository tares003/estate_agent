import { describe, expect, it, vi } from 'vitest';

import {
  buildRepairWhere,
  getRepairRequest,
  listRepairRequests,
  type RepairRow,
} from './repairs.js';

const NOW = new Date('2026-06-09T10:00:00.000Z').getTime();

function row(over: Partial<RepairRow> = {}): RepairRow {
  return {
    id: 'r1',
    name: 'Tess Tenant',
    reference: 'RPR-2026-00001',
    propertyReference: 'Flat 2, 14 Palatine Road',
    category: 'Plumbing',
    urgency: 'urgent',
    status: 'new',
    createdAt: new Date('2026-06-09T09:00:00.000Z'),
    ...over,
  };
}

function reader(rows: RepairRow[], total = rows.length) {
  return {
    repairRequest: {
      findMany: vi.fn().mockResolvedValue(rows),
      count: vi.fn().mockResolvedValue(total),
    },
  };
}

describe('buildRepairWhere', () => {
  it('hides closed tickets unless a status is asked for', () => {
    expect(buildRepairWhere({})).toEqual({ status: { notIn: ['completed', 'rejected'] } });
    expect(buildRepairWhere({ status: 'completed' })).toEqual({ status: 'completed' });
  });

  it('filters by urgency alongside the status default', () => {
    expect(buildRepairWhere({ urgency: 'emergency' })).toEqual({
      status: { notIn: ['completed', 'rejected'] },
      urgency: 'emergency',
    });
  });
});

describe('listRepairRequests', () => {
  it('lists newest-first by default, paginated, with totals', async () => {
    const db = reader([row()], 30);
    const result = await listRepairRequests(db, {}, NOW);

    expect(db.repairRequest.findMany).toHaveBeenCalledWith({
      where: { status: { notIn: ['completed', 'rejected'] } },
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 24,
    });
    expect(result.total).toBe(30);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(2);
  });

  it('sorts oldest-first and skips to the requested page', async () => {
    const db = reader([]);
    await listRepairRequests(db, { sort: 'oldest', page: 2 }, NOW);
    expect(db.repairRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'asc' }, skip: 24, take: 24 }),
    );
  });

  it('bands each open item by SLA risk against the injected now (FR-G-9)', async () => {
    // urgent target is 24h: 1h elapsed = on_track; 23h = at_risk; 25h = breached
    const db = reader([
      row({ id: 'a', createdAt: new Date(NOW - 1 * 3_600_000) }),
      row({ id: 'b', createdAt: new Date(NOW - 23 * 3_600_000) }),
      row({ id: 'c', createdAt: new Date(NOW - 25 * 3_600_000) }),
    ]);
    const result = await listRepairRequests(db, {}, NOW);
    expect(result.items.map((item) => item.slaRisk)).toEqual(['on_track', 'at_risk', 'breached']);
  });
});

describe('getRepairRequest', () => {
  it('reads one repair by id', async () => {
    const detail = { ...row(), email: 'tess@example.com', phone: null, description: 'Leaky tap' };
    const findFirst = vi.fn().mockResolvedValue(detail);

    const out = await getRepairRequest({ repairRequest: { findFirst } }, 'r1');

    expect(out).toBe(detail);
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'r1' } });
  });

  it('returns null for an unknown repair', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const out = await getRepairRequest({ repairRequest: { findFirst } }, 'nope');
    expect(out).toBeNull();
  });
});
