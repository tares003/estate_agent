# EPIC-G — Repair system (design)

**Dev brief:** [dev-briefs/v1/EPIC-G-repair-system.md](../../dev-briefs/v1/EPIC-G-repair-system.md).
**Master spec reference:** Section G.
**Pack:** Core (Lettings is part of core per PRODUCT.md §5).
**Status:** NOT_STARTED.

## Surfaces affected

- Tenant 6-step repair form.
- Tenant success page.
- Admin repair inbox.
- Admin repair detail view.
- Contractor magic-link portal.

## Layout patterns

### Tenant repair form

- Step-by-step wizard with a stepper at the top showing completed / current / upcoming steps.
- One step per screen on mobile; one step per panel on desktop with the previous step collapsed but reviewable.
- Emergency notice as a banner at the top of step 1 with the emergency phone number prominently presented.
- File upload uses a drag-drop dropzone with tap-to-pick fallback on mobile. Upload progress per file.
- Review step shows every captured value in a readable summary before submission.
- Success page shows the ticket reference in `--text-display-sm` and a "what happens next" timeline.

### Admin repair inbox

- Top bar: urgency pills (Emergency / Urgent / Standard / Non-urgent) with counts that act as filters.
- Table columns: ticket reference, tenant, address, category, urgency, status, assignee, age, last update, SLA badge.
- Row click opens a slide-over for triage.
- Double-click opens the full detail view.

### Admin repair detail

- Header: ticket reference, status, urgency, "Mark as emergency" toggle, assign-to dropdowns.
- Tabs: Overview / Activity timeline / Files / Internal notes / Messages.
- Activity timeline shows every status transition, file upload, message and note in reverse chronological order.
- Compose box at the bottom of the activity timeline switches between Note / Email / SMS / Call log.

### Contractor portal

- Minimalist single-page view with: ticket details, photos, "Upload completion photos" dropzone, "Mark work complete" CTA.
- No navigation chrome (no header / footer / sidebar). Optimised for one-handed mobile use from a van.

## Component inventory

`MultiStepForm`, `FormReviewSummary`, `FormSuccess`, `FileDropzone`, `Stepper`, `StatusBadge` (priority + urgency variants), `AdminTable`, `Drawer` (for the inbox slide-over), `ActivityFeed`, `CalendarView`, plus a new `ContractorPortalShell` minimal layout.

## State variations

- **Tenant — emergency:** the emergency notice banner becomes more prominent if the user selects emergency urgency. A confirmation step appears.
- **Tenant — upload failed:** retry button per failed file; the form does not block submission until either the upload retries or the user removes the file.
- **Admin — overdue ticket:** SLA badge becomes red and the row gets a subtle red left-border accent.
- **Contractor — already completed:** the magic-link URL shows a read-only summary if the contractor has already marked complete.

## Accessibility specifics

- The Stepper is announced as "Step X of Y, [step name]" via `aria-current`.
- Emergency notice has `role="alert"` only when first shown, then becomes static.
- File upload dropzone has a keyboard-focusable file-picker fallback.
- Contractor portal is fully keyboard-navigable.

## Responsive behaviour

- Tenant form is mobile-first. Time-slot pickers and category pickers become large tappable cards on mobile.
- Admin inbox table converts to stacked cards below `--breakpoint-md`.
- Activity timeline scrolls within the detail view rather than the page.

## Motion

- Stepper progress updates over `--motion-duration-base`.
- File-upload progress is real-time (no easing).
- SLA badge colour change is immediate (no transition) to convey urgency.

## Token references

- Urgency colours via `--colour-priority-*` tokens.
- Emergency notice uses `--colour-danger` left border on `--colour-surface-base`.

## Open design questions

1. Confirm whether the tenant success page offers a "track this ticket" link (requires customer account flow).
2. Confirm the visual treatment of the activity timeline message threads (chat-bubble style vs row-list).
3. Confirm whether the contractor portal needs a dark-mode variant for in-van readability.
4. Confirm the emergency-notice tone — strict and serious or friendly and direct?
