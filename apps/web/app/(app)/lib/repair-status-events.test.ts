import { describe, expect, it, vi } from 'vitest';

import {
  listRepairStatusEvents,
  type RepairStatusEventRow,
} from './repair-status-events.js';

function row(over: Partial<RepairStatusEventRow> = {}): RepairStatusEventRow {
  return {
    id: 'e1',
    fromStatus: 'new',
    toStatus: 'triaged',
    actorUserId: null,
    notes: null,
    createdAt: new Date('2026-06-09T10:00:00.000Z'),
    ...over,
  };
}

describe('listRepairStatusEvents', () => {
  it('queries the given repair, newest-first, and returns the rows', async () => {
    const rows = [row()];
    const findMany = vi.fn().mockResolvedValue(rows);

    const out = await listRepairStatusEvents({ repairStatusEvent: { findMany } }, 'rep-1');

    expect(out).toBe(rows);
    expect(findMany).toHaveBeenCalledWith({
      where: { repairRequestId: 'rep-1' },
      orderBy: { createdAt: 'desc' },
    });
  });
});
