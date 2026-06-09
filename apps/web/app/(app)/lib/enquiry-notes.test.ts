// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import {
  buildEnquiryNotesWhere,
  listEnquiryNotes,
  type EnquiryNote,
  type NoteListReader,
} from './enquiry-notes.js';

// EPIC-I CRM (FR-I-5): the enquiry note thread read model. DB-free (a structural
// client); the live query runs tenant-scoped via withTenant. Notes are polymorphic
// (entityType + entityId); a client-facing view excludes internal notes.

const ENQ = '11111111-1111-1111-1111-111111111111';
const NOW = 1_000_000_000_000;

function note(over: Partial<EnquiryNote> = {}): EnquiryNote {
  return {
    id: 'n1',
    body: 'Called the buyer.',
    isInternal: true,
    authorAgentId: null,
    createdAt: new Date(NOW),
    ...over,
  };
}

describe('buildEnquiryNotesWhere', () => {
  it('scopes to the enquiry and shows every note by default (staff view)', () => {
    expect(buildEnquiryNotesWhere(ENQ, {})).toEqual({ entityType: 'enquiry', entityId: ENQ });
  });

  it('excludes internal notes for a client-facing view', () => {
    expect(buildEnquiryNotesWhere(ENQ, { includeInternal: false })).toEqual({
      entityType: 'enquiry',
      entityId: ENQ,
      isInternal: false,
    });
  });
});

function reader(rows: EnquiryNote[]): { db: NoteListReader; calls: unknown[] } {
  const calls: unknown[] = [];
  const db: NoteListReader = {
    note: {
      findMany: vi.fn(async (args) => {
        calls.push(args);
        return rows;
      }),
    },
  };
  return { db, calls };
}

describe('listEnquiryNotes', () => {
  it('returns the thread newest-first, scoped to the enquiry', async () => {
    const { db, calls } = reader([note({ id: 'a' }), note({ id: 'b' })]);
    const result = await listEnquiryNotes(db, ENQ, {});
    expect(result.map((n) => n.id)).toEqual(['a', 'b']);
    expect(calls[0]).toMatchObject({
      where: { entityType: 'enquiry', entityId: ENQ },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('applies the client-facing internal filter', async () => {
    const { db, calls } = reader([]);
    await listEnquiryNotes(db, ENQ, { includeInternal: false });
    expect((calls[0] as { where: unknown }).where).toEqual({
      entityType: 'enquiry',
      entityId: ENQ,
      isInternal: false,
    });
  });
});
