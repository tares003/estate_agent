import { describe, expect, it } from 'vitest';

import {
  FEEDBACK_COMMENT_MAX,
  FEEDBACK_DECISIONS,
  feedbackDecisionStatus,
  feedbackEditSchema,
  feedbackModerationSchema,
  feedbackSubmissionSchema,
} from './feedback.js';

// EPIC-AC FR-AC-3 — the brief feedback form: a 1–5 star rating, an optional short
// comment, and a "may we publish this as a testimonial?" toggle. The respondent is
// anonymous (FR-AC-4 — the token identifies them), so the form captures NO personal
// data and carries no GDPR-consent affirmation; the publish toggle is a publishing
// consent, not a personal-data one.

describe('feedbackSubmissionSchema', () => {
  it('accepts a rating with an optional comment + publish toggle', () => {
    const parsed = feedbackSubmissionSchema.parse({
      rating: 5,
      comment: 'Brilliant service from start to finish.',
      publishAsTestimonial: true,
    });
    expect(parsed).toEqual({
      rating: 5,
      comment: 'Brilliant service from start to finish.',
      publishAsTestimonial: true,
    });
  });

  it('coerces the rating from a form string', () => {
    expect(feedbackSubmissionSchema.parse({ rating: '4' }).rating).toBe(4);
  });

  it('rejects a rating outside 1–5 or non-integer', () => {
    for (const rating of [0, 6, 4.5, -1]) {
      expect(feedbackSubmissionSchema.safeParse({ rating }).success).toBe(false);
    }
  });

  it('defaults publishAsTestimonial to false and the comment to absent', () => {
    const parsed = feedbackSubmissionSchema.parse({ rating: 3 });
    expect(parsed.publishAsTestimonial).toBe(false);
    expect(parsed.comment).toBeUndefined();
  });

  it('treats a blank comment as no comment', () => {
    expect(feedbackSubmissionSchema.parse({ rating: 3, comment: '   ' }).comment).toBeUndefined();
  });

  it('rejects an over-long comment', () => {
    const long = 'x'.repeat(2001);
    expect(feedbackSubmissionSchema.safeParse({ rating: 3, comment: long }).success).toBe(false);
  });
});

// EPIC-AC FR-AC-5 — the staff moderation decision on publishable feedback: publish
// it (→ flows to testimonials) or reject it WITH a captured reason.
describe('feedbackModerationSchema', () => {
  it('lists the two decisions', () => {
    expect(FEEDBACK_DECISIONS).toEqual(['publish', 'reject']);
  });

  it('accepts publish with no reason', () => {
    expect(feedbackModerationSchema.safeParse({ decision: 'publish' }).success).toBe(true);
  });

  it('requires a reason when rejecting (FR-AC-5 — reasons captured for audit)', () => {
    expect(feedbackModerationSchema.safeParse({ decision: 'reject' }).success).toBe(false);
    expect(feedbackModerationSchema.safeParse({ decision: 'reject', reason: '   ' }).success).toBe(
      false,
    );
    expect(
      feedbackModerationSchema.safeParse({ decision: 'reject', reason: 'Off-topic.' }).success,
    ).toBe(true);
  });

  it('rejects an unknown decision', () => {
    expect(feedbackModerationSchema.safeParse({ decision: 'archive' }).success).toBe(false);
  });

  it('feedbackDecisionStatus maps a decision to the terminal moderation status', () => {
    expect(feedbackDecisionStatus('publish')).toBe('published');
    expect(feedbackDecisionStatus('reject')).toBe('rejected');
  });
});

// EPIC-AC FR-AC-5 — a minor edit to a pending entry's comment before it is
// published. "Minor edits only": the comment text is the only editable field
// (rating, trigger and respondent are immutable). A blank comment clears it.
describe('feedbackEditSchema', () => {
  it('accepts a trimmed comment edit', () => {
    expect(feedbackEditSchema.parse({ comment: '  Tidied wording.  ' })).toEqual({
      comment: 'Tidied wording.',
    });
  });

  it('treats a blank / whitespace-only comment as a clear (null)', () => {
    expect(feedbackEditSchema.parse({ comment: '   ' }).comment).toBeNull();
    expect(feedbackEditSchema.parse({ comment: '' }).comment).toBeNull();
    expect(feedbackEditSchema.parse({}).comment).toBeNull();
  });

  it('rejects an over-long comment (shares the submission cap)', () => {
    const long = 'x'.repeat(FEEDBACK_COMMENT_MAX + 1);
    expect(feedbackEditSchema.safeParse({ comment: long }).success).toBe(false);
  });
});
