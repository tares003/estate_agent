import { describe, expect, it, vi } from 'vitest';

import { getRepairRequest, listRepairRequests, type RepairRow } from './repairs.js';

function row(over: Partial<RepairRow> = {}): RepairRow {
  return {
    id: 'r1',
    name: 'Tess Tenant',
    reference: 'Flat 2, 14 Palatine Road',
    category: 'Plumbing',
    urgency: 'urgent',
    status: 'new',
    createdAt: new Date('2026-06-09T10:00:00.000Z'),
    ...over,
  };
}

describe('listRepairRequests', () => {
  it('lists the tenant repairs newest-first and returns the rows', async () => {
    const rows = [row(), row({ id: 'r2' })];
    const findMany = vi.fn().mockResolvedValue(rows);

    const out = await listRepairRequests({ repairRequest: { findMany } });

    expect(out).toBe(rows);
    expect(findMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'desc' } });
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
