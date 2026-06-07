# EPIC-AC — Feedback and review collection (design)

**Dev brief:** [dev-briefs/v1/EPIC-AC-feedback-reviews.md](../../dev-briefs/v1/EPIC-AC-feedback-reviews.md).
**Status:** NOT_STARTED.

## Surfaces affected

- Feedback email (a brand-consistent transactional template).
- `/feedback/[token]` (public feedback form, no sign-in).
- Admin moderation queue at `/admin/feedback`.
- Admin per-piece moderation detail.
- Public reviews badge on every public page (existing badge, now data-driven).
- Public testimonials display on landing pages (existing, now populated by published feedback).
- Vendor portal viewing-feedback display (consumed by EPIC-Y).
- Agent league-table report (consumed by EPIC-H).

## Feedback form layout

- Single-page form, no sign-in, no navigation chrome.
- Top: small agency logo and a one-sentence context line ("We hope your viewing of [property] went well — your feedback helps us help you find the right home").
- Star rating (5 stars, large, keyboard-operable).
- Optional comment textarea with a placeholder ("Anything you'd like to share?").
- "May we publish this as a testimonial?" toggle, off by default with a tiny explanatory caption.
- "Opt out of future feedback requests" link in the footer.
- Submit button.
- Success state: "Thank you — your feedback has been recorded" with no further CTA.

## Admin moderation queue

- Table with: rating star pills, snippet of comment, trigger type (viewing / sale / tenancy-start / repair / tenancy-end), respondent (anonymised), date, status (pending / published / rejected / edited).
- Quick filters: All / Pending / Published / Rejected / Needs response (negative).
- Per-entry actions: Publish, Reject (with reason), Edit (minor only).
- Bulk publish for batches of high-rated feedback with no comment.

## Public reviews badge

- Compact pill: average rating in headline figure ("4.7"), star row beneath, "from X reviews" caption.
- Click expands to a modal showing recent published testimonials.
- The hardcoded text era ends here — the badge reflects actual data.

## Negative-feedback alert (in admin alerts panel)

- Title: "Negative feedback received from [respondent role] on [trigger]".
- Body: rating, snippet of comment, link to detail.
- Primary action: "Acknowledge and reply".

## Component inventory

`FeedbackForm`, `FeedbackEmailTemplate`, `FeedbackModerationQueue`, `FeedbackModerationDetail`, `ReviewsBadge` (refactored from existing static component), `TestimonialsCarouselDataDriven`, `AgentRatingPill`, `VendorViewingFeedbackPanel`. Built on EPIC-L primitives.

## State variations

- **No feedback yet:** the public reviews badge falls back to a clearly different display ("Reviews coming soon") rather than showing a fake number. This is an explicit anti-pattern: the badge should never show a hardcoded score.
- **Pending moderation:** the moderation queue shows the count prominently and an "X awaiting review" notice on the admin dashboard alerts panel.
- **Cross-posting failure:** the moderation detail shows a "Cross-post to Google failed" status with retry CTA.
- **Opt-out completed:** "You won't receive future feedback requests" confirmation; the form replaces with a thank-you message.
- **Token expired:** "This feedback link has expired" with no further CTA (no way to recover; respondent can email instead).

## Accessibility specifics

- Star rating uses real radio inputs under the visual layer; keyboard arrow keys navigate.
- Comment textarea has a label and a visible character counter (no max-length blocking).
- Form errors announced via `aria-live="polite"`.
- The opt-out link is visible and not hidden in small text.

## Responsive

- Feedback form is mobile-first; star size scales up on mobile for tap targets.
- Moderation queue table converts to stacked cards below `--breakpoint-md`.

## Motion

- Star rating: subtle scale on hover/focus, instant on selection.
- Submit success: gentle fade from form to success message over `--motion-duration-base`.
- Negative feedback alert: no animation (seriousness over delight).

## Token references

- Filled stars: `--colour-brand-accent`.
- Unfilled stars: `--colour-border`.
- Rating pill colour band: green ≥ 4, amber 3, red ≤ 2 (using semantic tokens).

## Open design questions

1. Confirm whether the form supports per-trigger custom questions in V1.
2. Confirm the visual treatment of the testimonial-permission toggle (recommended: visible label, default off, no surprise).
3. Confirm whether the reviews badge surfaces source mix when external cross-posting is on.
4. Confirm the rating-scale convention (5 stars vs 10 points — recommended: 5 stars to match the UK property review market).
