import { z } from 'zod';

// EPIC-AC FR-AC-3/4 — the brief feedback form's input. A 1–5 rating, an optional
// short comment, and a publish-as-testimonial toggle. The one-time token identifies
// the respondent (FR-AC-2/4), but the free-text comment can carry personal data and
// the submission may be published as a testimonial, so this IS a public personal-data
// form: it carries an explicit GDPR-consent affirmation (`gdpr_consent`, G5 / master
// spec §S.7). `publishAsTestimonial` is a separate publishing consent.

/** Max length of the free-text comment (kept short per the brief — "a short comment"). */
export const FEEDBACK_COMMENT_MAX = 2000;

export const feedbackSubmissionSchema = z.object({
  /** Star rating, 1–5 (coerced from the form's string value). */
  rating: z.coerce.number().int().min(1).max(5),
  /** Optional short comment; a blank / whitespace-only value is treated as none. */
  comment: z.preprocess((value) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, z.string().max(FEEDBACK_COMMENT_MAX).optional()),
  /** "May we publish this as a testimonial?" — the action coerces the checkbox. */
  publishAsTestimonial: z.boolean().default(false),
  /** GDPR-consent affirmation — must be explicitly `true` (G5 / master spec §S.7). */
  gdpr_consent: z.literal(true),
});

/** A validated feedback submission. */
export type FeedbackSubmission = z.infer<typeof feedbackSubmissionSchema>;

// EPIC-AC FR-AC-5 — the staff moderation decision on publishable feedback.

/** The two moderation decisions an admin can take. */
export const FEEDBACK_DECISIONS = ['publish', 'reject'] as const;

export const feedbackModerationSchema = z
  .object({
    decision: z.enum(FEEDBACK_DECISIONS),
    /** Required when rejecting (FR-AC-5 — reject reasons are captured for audit). */
    reason: z.string().trim().max(1000).optional(),
  })
  .refine(
    (data) =>
      data.decision !== 'reject' || (typeof data.reason === 'string' && data.reason.length > 0),
    { message: 'A reason is required when rejecting feedback.', path: ['reason'] },
  );

/** A moderation decision (one of {@link FEEDBACK_DECISIONS}). */
export type FeedbackDecision = (typeof FEEDBACK_DECISIONS)[number];

/** A validated moderation decision. */
export type FeedbackModeration = z.infer<typeof feedbackModerationSchema>;

/** Map a moderation decision to the terminal FeedbackStatus it sets. */
export function feedbackDecisionStatus(decision: FeedbackDecision): 'published' | 'rejected' {
  return decision === 'publish' ? 'published' : 'rejected';
}

// EPIC-AC FR-AC-5 — a minor edit to a still-pending entry. "Minor edits only":
// the comment text is the ONLY editable field (the rating, trigger and respondent
// stay immutable). A blank / whitespace-only comment clears it (→ null), so the
// schema normalises to `string | null` rather than an absent key.

export const feedbackEditSchema = z.object({
  /** The new comment text; blank / whitespace-only clears the comment (→ null). */
  comment: z.preprocess((value) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, z.string().max(FEEDBACK_COMMENT_MAX).nullable().default(null)),
});

/** A validated minor edit (comment-only). */
export type FeedbackEdit = z.infer<typeof feedbackEditSchema>;
