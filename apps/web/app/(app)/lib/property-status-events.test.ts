import { describe, expect, it, vi } from 'vitest';

import { listPropertyStatusEvents, type PropertyStatusEventRow } from './property-status-events.js';

function row(over: Partial<PropertyStatusEventRow> = {}): PropertyStatusEventRow {
  return {
    id: 'e1',
    fromStatus: 'for_sale',
    toStatus: 'under_offer',
    changedByAgentId: null,
    changedAt: new Date('2026-06-09T10:00:00.000Z'),
    ...over,
  };
}

describe('listPropertyStatusEvents', () => {
  it('queries the given property, newest-first, and returns the rows', async () => {
    const rows = [row()];
    const findMany = vi.fn().mockResolvedValue(rows);

    const out = await listPropertyStatusEvents({ propertyStatusEvent: { findMany } }, 'prop-1');

    expect(out).toBe(rows);
    expect(findMany).toHaveBeenCalledWith({
      where: { propertyId: 'prop-1' },
      orderBy: { changedAt: 'desc' },
    });
  });
});
