// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import {
  listEnquiryStatusEvents,
  type EnquiryStatusEventRow,
  type StatusEventReader,
} from './enquiry-status-events.js';

function event(over: Partial<EnquiryStatusEventRow> = {}): EnquiryStatusEventRow {
  return {
    id: 'ev1',
    fromStatus: 'new',
    toStatus: 'contacted',
    changedByAgentId: null,
    changedAt: new Date(1_000_000_000_000),
    ...over,
  };
}

function reader(rows: EnquiryStatusEventRow[]): { db: StatusEventReader; calls: unknown[] } {
  const calls: unknown[] = [];
  const db: StatusEventReader = {
    enquiryStatusEvent: {
      findMany: vi.fn(async (args) => {
        calls.push(args);
        return rows;
      }),
    },
  };
  return { db, calls };
}

describe('listEnquiryStatusEvents', () => {
  it('returns the enquiry transitions newest-first', async () => {
    const { db, calls } = reader([event({ id: 'a' }), event({ id: 'b' })]);
    const result = await listEnquiryStatusEvents(db, 'enq-1');
    expect(result.map((e) => e.id)).toEqual(['a', 'b']);
    expect(calls[0]).toMatchObject({
      where: { enquiryId: 'enq-1' },
      orderBy: { changedAt: 'desc' },
    });
  });
});
