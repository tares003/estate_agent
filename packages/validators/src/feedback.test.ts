import { describe, expect, it } from 'vitest';

import { feedbackSubmissionSchema } from './feedback.js';

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
