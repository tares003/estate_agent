import { describe, expect, it } from 'vitest';

import { enquiryNoteCreateSchema } from './enquiry-note.js';

// EPIC-I CRM (FR-I-5): threaded notes on an enquiry. A note carries a body and an
// "is internal" flag controlling whether it surfaces in client-facing comms; a
// note defaults to internal (staff-private) unless explicitly made client-visible.

const id = '11111111-1111-1111-1111-111111111111';

describe('enquiryNoteCreateSchema', () => {
  it('accepts a note and defaults isInternal to true (staff-private)', () => {
    const result = enquiryNoteCreateSchema.safeParse({ enquiryId: id, body: 'Called the buyer.' });
    expect(result.success).toBe(true);
    expect(result.success && result.data.isInternal).toBe(true);
  });

  it('accepts an explicit client-visible note', () => {
    const result = enquiryNoteCreateSchema.safeParse({
      enquiryId: id,
      body: 'Viewing confirmed for Saturday.',
      isInternal: false,
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.isInternal).toBe(false);
  });

  it('trims the body and rejects an empty / whitespace-only note', () => {
    expect(enquiryNoteCreateSchema.safeParse({ enquiryId: id, body: '   ' }).success).toBe(false);
    expect(enquiryNoteCreateSchema.safeParse({ enquiryId: id, body: '' }).success).toBe(false);
    const trimmed = enquiryNoteCreateSchema.safeParse({ enquiryId: id, body: '  hi  ' });
    expect(trimmed.success && trimmed.data.body).toBe('hi');
  });

  it('rejects a non-uuid enquiryId', () => {
    expect(enquiryNoteCreateSchema.safeParse({ enquiryId: 'nope', body: 'x' }).success).toBe(false);
  });

  it('rejects a body beyond the max length', () => {
    const tooLong = 'a'.repeat(5001);
    expect(enquiryNoteCreateSchema.safeParse({ enquiryId: id, body: tooLong }).success).toBe(false);
  });
});
