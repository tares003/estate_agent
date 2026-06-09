import { describe, expect, it } from 'vitest';

import {
  ENQUIRY_STATUSES,
  ENQUIRY_STATUS_TRANSITIONS,
  LOST_REASONS,
  canTransition,
  enquiryStatusUpdateSchema,
} from './enquiry-status.js';

// EPIC-I CRM (master spec §I.3): the enquiry status workflow. The statuses use the
// committed Prisma enum values (schema is source of truth, G6); transitions are an
// allow-list; marking an enquiry `lost` requires a reason.

describe('ENQUIRY_STATUSES', () => {
  it('is the eight committed enum values in order', () => {
    expect(ENQUIRY_STATUSES).toEqual([
      'new',
      'contacted',
      'viewing_booked',
      'valuation_booked',
      'waiting',
      'converted',
      'lost',
      'archived',
    ]);
  });

  it('declares an allowed-next list for every status', () => {
    for (const status of ENQUIRY_STATUSES) {
      expect(Array.isArray(ENQUIRY_STATUS_TRANSITIONS[status])).toBe(true);
    }
  });
});

describe('canTransition', () => {
  it.each([
    ['new', 'contacted', true],
    ['new', 'archived', true],
    ['new', 'viewing_booked', false], // cannot skip `contacted`
    ['contacted', 'lost', true],
    ['contacted', 'converted', true],
    ['waiting', 'contacted', true],
    ['converted', 'archived', true],
    ['converted', 'new', false],
    ['lost', 'archived', true],
    ['archived', 'contacted', false], // terminal
    ['new', 'new', false], // same-status no-op
    ['nonsense', 'contacted', false], // unknown source status
  ] as const)('%s -> %s = %s', (from, to, expected) => {
    expect(canTransition(from, to)).toBe(expected);
  });
});

describe('enquiryStatusUpdateSchema', () => {
  const id = '11111111-1111-1111-1111-111111111111';

  it('accepts a normal transition with no reason', () => {
    expect(enquiryStatusUpdateSchema.safeParse({ enquiryId: id, to: 'contacted' }).success).toBe(
      true,
    );
  });

  it('requires a reason when marking lost', () => {
    expect(enquiryStatusUpdateSchema.safeParse({ enquiryId: id, to: 'lost' }).success).toBe(false);
    expect(
      enquiryStatusUpdateSchema.safeParse({ enquiryId: id, to: 'lost', reason: 'price' }).success,
    ).toBe(true);
  });

  it('rejects an unknown status, an invalid reason, and a non-uuid id', () => {
    expect(enquiryStatusUpdateSchema.safeParse({ enquiryId: id, to: 'sold' }).success).toBe(false);
    expect(
      enquiryStatusUpdateSchema.safeParse({ enquiryId: id, to: 'lost', reason: 'whatever' })
        .success,
    ).toBe(false);
    expect(
      enquiryStatusUpdateSchema.safeParse({ enquiryId: 'nope', to: 'contacted' }).success,
    ).toBe(false);
  });

  it('exposes the canonical lost reasons', () => {
    expect(LOST_REASONS).toEqual(['price', 'location', 'fell_through', 'no_response', 'other']);
  });
});
