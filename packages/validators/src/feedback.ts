import { z } from 'zod';

// EPIC-AC FR-AC-3 — the brief feedback form's input. A 1–5 rating, an optional
// short comment, and a publish-as-testimonial toggle. The respondent is anonymous
// (the one-time token identifies them, FR-AC-2/4), so this captures NO personal
// data and carries no GDPR-consent affirmation; `publishAsTestimonial` is a
// publishing consent, not a personal-data one.

/** Max length of the free-text comment (kept short per the brief — "a short comment"). */
export const FEEDBACK_COMMENT_MAX = 2000;

export const feedbackSubmissionSchema = z.object({
  /** Star rating, 1–5 (coerced from the form's string value). */
  rating: z.coerce.number().int().min(1).max(5),
  /** Optional short comment; a blank / whitespace-only value is treated as none. */
  comment: z.preprocess(
    (value) => {
      if (typeof value !== 'string') return value;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    },
    z.string().max(FEEDBACK_COMMENT_MAX).optional(),
  ),
  /** "May we publish this as a testimonial?" — the action coerces the checkbox. */
  publishAsTestimonial: z.boolean().default(false),
});

/** A validated feedback submission. */
export type FeedbackSubmission = z.infer<typeof feedbackSubmissionSchema>;
