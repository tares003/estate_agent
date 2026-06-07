# EPIC-AC — Feedback and review collection

**Master spec reference:** Section B.36 (reviews widget), Section J (testimonials), Section H.21 (agent league table).
**Pack:** `feedback_reviews` (add-on; included with Professional and Enterprise tiers).
**Status:** NOT_STARTED.
**Paired design brief:** [design-briefs/v1/EPIC-AC-feedback-reviews.md](../../design-briefs/v1/EPIC-AC-feedback-reviews.md).

## Purpose

A platform-wide feedback collection system that captures structured feedback at every meaningful moment in the user journey — after a viewing, after a sale completes, after a tenancy starts and ends, after a repair completes — and feeds that feedback into: the public reviews widget (currently hardcoded), the agent-performance reports, the vendor portal's viewing-feedback display, the testimonials entity, and the per-tenant Trust Pilot / Google Reviews aggregator (where configured).

Without this brief, the "4.9/5 from 1,000+ reviews" badge that appears on every public page is just hardcoded text. With it, the badge reflects actual collected feedback.

## Functional requirements

- **FR-AC-1.** The platform shall send a feedback request via email (and optionally SMS) at configured trigger points:
  - 2 hours after a viewing's `outcome` is set to `attended`.
  - 24 hours after a sale's `market_status` transitions to `sold`.
  - 7 days after a tenancy starts.
  - 24 hours after a repair ticket transitions to `completed`.
  - Tenancy-end exit interview at the configured offboarding point.
  - Mid-year tenancy review (optional, configurable).
- **FR-AC-2.** Feedback requests shall include a one-time-token URL leading to a feedback form, with no sign-in step.
- **FR-AC-3.** The feedback form shall be brief — a star rating (1-5) plus a short comment (optional) plus a "May we publish this as a testimonial?" toggle.
- **FR-AC-4.** Submitted feedback shall populate a `feedback` entity with: trigger type, trigger record (e.g. viewing_request_id), respondent (anonymous identifier only), rating, comment, publish-as-testimonial flag, timestamp.
- **FR-AC-5.** Feedback marked publishable shall enter a moderation queue. An admin shall be able to publish, reject (with reason), or edit (minor edits only) each entry. Published entries flow to the `testimonials` entity.
- **FR-AC-6.** The public reviews badge shall display: aggregate score (average rating across all feedback) and total count, both computed live and cached at a configurable interval.
- **FR-AC-7.** The agent league-table report (master spec H.21) shall include the agent's average rating from feedback tagged with their actor identifier.
- **FR-AC-8.** Per-tenant integration shall be supported: where the tenant has connected a Google Business Profile, Trustpilot or Reviews.io account, feedback that the respondent opts into shall be cross-posted to the external review surface via the chosen integration.
- **FR-AC-9.** A respondent shall be able to opt out of all future feedback requests at the form's footer, recording the opt-out in `subscribers` or a new opt-out table.
- **FR-AC-10.** Feedback that includes negative sentiment (rating ≤ 2, or comment-based detection where enabled) shall be flagged as "needs response" and surfaced in the admin alerts panel.
- **FR-AC-11.** The vendor portal (EPIC-Y) shall surface viewing feedback collected through this system, subject to the agency's disclosure policy.
- **FR-AC-12.** The repair confirmation page (EPIC-G) shall trigger the post-repair feedback request as part of the existing `repair_completed_satisfaction` template hook.

## User stories

- As an agency director, I want to know my actual aggregate review score so I can put it on every page with confidence.
- As an applicant who viewed a property and didn't like it, I want to give honest feedback on the property without feeling pressured into rating the agent.
- As a vendor, I want to see what applicants thought of my property after their viewings.
- As a branch manager, I want to see which of my agents are getting consistently high feedback.
- As a property manager, I want to know immediately when a tenant rates a completed repair poorly so I can follow up.

## Acceptance criteria

- A viewing marked attended produces a feedback email within the configured window (default: 2 hours).
- Submitting feedback updates the aggregate score on the public reviews badge within the configured cache interval (default: 15 minutes).
- A 1-star feedback triggers an admin alert within 60 seconds of submission.
- Moderation reject reasons are captured for audit.
- A respondent who has opted out does not receive future requests.
- Cross-posting to a connected Google / Trustpilot / Reviews.io account is exactly-once per piece of feedback.

## Test mapping

```
FR-AC-1  → tests/integration/feedback-triggers.test.* (per trigger)
FR-AC-2  → tests/integration/feedback-magic-token.test.*
FR-AC-3  → tests/component/feedback-form.test.*
FR-AC-4  → tests/integration/feedback-persistence.test.*
FR-AC-5  → tests/integration/feedback-moderation.test.*
FR-AC-6  → tests/integration/reviews-aggregate.test.*
FR-AC-7  → tests/integration/agent-rating-rollup.test.*
FR-AC-8  → tests/integration/external-review-cross-post.test.* (per supported product)
FR-AC-9  → tests/integration/feedback-opt-out.test.*
FR-AC-10 → tests/integration/negative-feedback-alert.test.*
FR-AC-11 → tests/integration/vendor-portal-feedback-surface.test.*
FR-AC-12 → tests/integration/repair-feedback-trigger.test.*
A11y     → tests/a11y/feedback-form.spec.*
Regression → tests/regression/EPIC-AC/EPIC-AC-aggregate-rollup.regression.test.*
```

## Dependencies

- EPIC-J — new `feedback` entity, optional `feedback_opt_outs` table.
- EPIC-G — repair completion trigger.
- EPIC-I — viewing attended trigger.
- EPIC-U — the trigger workers and the aggregate-rollup worker.
- EPIC-Y — vendor portal feedback surface.
- EPIC-H — moderation queue + alerts panel surfaces.
- EPIC-K — public capability for the reviews aggregate (FR-AC-6).

## Open questions

1. Confirm the V1 cross-post targets (recommended: Google Business Profile + Reviews.io; defer Trustpilot pending contract).
2. Confirm whether the feedback form supports per-trigger custom questions (e.g. viewing form asks "Would you bid?", repair form asks "Was the issue fully resolved?") — recommended: yes V1 with admin-editable templates.
3. Confirm the V1 moderation policy default (recommended: published-by-default unless flagged; agency may switch to moderation-required).
4. Confirm the cache interval for the public aggregate (recommended: 15 minutes; configurable).
5. Confirm whether the reviews badge can show source-mix (e.g. "4.7/5 across 320 reviews on our platform + 180 on Google") — recommended: yes if cross-posting is enabled.
