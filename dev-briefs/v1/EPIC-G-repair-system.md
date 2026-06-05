# EPIC-G — Repair system

**Master spec reference:** Section G (G.1–G.7).
**Status:** NOT_STARTED.
**Paired design brief:** [design-briefs/v1/EPIC-G-repair-system.md](../../design-briefs/v1/EPIC-G-repair-system.md).

## Purpose

Implement the tenant-facing multi-step repair-report form, the admin repair-ticket workflow, the contractor magic-link portal, the urgency-driven SLA, and the threaded messaging between tenant, staff and contractor.

## Functional requirements

- **FR-G-1.** A tenant shall be able to submit a repair request through a six-step form that captures: contact details, property address, repair category, description, urgency, photo / video uploads, access permission, GDPR consent.
- **FR-G-2.** File uploads shall use pre-signed direct upload URLs. The file URL is recorded with the ticket; the application server shall never proxy the bytes.
- **FR-G-3.** On submission, the platform shall: persist the ticket, send a tenant confirmation email with a human-readable ticket reference, send the configured internal notifications, and (if urgency = emergency) additionally send SMS and team-messaging channel notifications.
- **FR-G-4.** The repair category catalogue shall be admin-editable. Default categories are listed in master spec Section G.3.
- **FR-G-5.** The urgency taxonomy (emergency, urgent, standard, non-urgent) shall be admin-editable with per-urgency SLA targets per master spec Section G.4.
- **FR-G-6.** The ticket status workflow shall follow master spec Section G.5, with off-path states (awaiting_tenant, on_hold, rejected) handled.
- **FR-G-7.** Every status transition shall be recorded in the repair status history with actor, notes and timestamp.
- **FR-G-8.** A contractor shall be able to access the ticket via a magic-link URL without signing in to the main admin, view ticket details (excluding internal notes), upload completion photos, and mark work complete (transitioning the status to `awaiting_review`).
- **FR-G-9.** The admin inbox shall display SLA-breach risk badges that change colour at configurable thresholds (default: green ≤ 50%, amber 50–75%, red > 75%, breached at 100%).
- **FR-G-10.** Bulk emergency dispatch (master spec Section H.8) shall allow one contractor job to cover multiple tickets at the same address or building.
- **FR-G-11.** Recurring maintenance (annual gas safety, EICR, PAT testing) shall auto-generate tickets at the configured lead time before due date.
- **FR-G-12.** Threaded messaging shall support staff-to-tenant, tenant-to-staff, and staff-internal directions. Inbound tenant replies (via email) shall be threaded into the same ticket using the message identifier.

## User stories

- As a tenant whose boiler has broken in winter, I want to report a repair from my phone in under two minutes and get a confirmation that it has been received.
- As a property manager, I want to see all my outstanding tickets in one queue with SLA badges so that I can prioritise.
- As a contractor, I want to mark a job complete without logging in, so I can close out from the van.
- As a branch manager, I want to be paged when an emergency ticket comes in outside hours.

## Acceptance criteria

- A tenant can submit a ticket with five photos on a mid-range mobile device in under 90 seconds.
- An emergency-urgency ticket triggers all configured emergency channels simultaneously within 60 seconds.
- The contractor magic-link URL can be opened on a mobile device, used to upload completion photos and used to mark complete — all without any sign-in step.
- The SLA badge transitions colour at the configured thresholds.
- Recurring maintenance tickets auto-appear in the queue at the configured lead time.
- Threaded messages are correctly attributed and time-ordered.

## Test mapping

```
FR-G-1  → tests/e2e/tenant-repair-form.spec.* (each step), tests/integration/repair-create.test.*
FR-G-2  → tests/integration/repair-presigned-upload.test.*
FR-G-3  → tests/integration/repair-notifications.test.* (emergency variant included)
FR-G-4  → tests/integration/repair-category-admin.test.*
FR-G-5  → tests/integration/repair-urgency-admin.test.*
FR-G-6  → tests/integration/repair-status-workflow.test.* (every transition + off-path states)
FR-G-7  → tests/integration/repair-status-history.test.*
FR-G-8  → tests/e2e/contractor-magic-link.spec.*
FR-G-9  → tests/component/repair-sla-badge.test.*
FR-G-10 → tests/integration/repair-bulk-dispatch.test.*
FR-G-11 → tests/integration/repair-recurring-maintenance.test.*
FR-G-12 → tests/integration/repair-threaded-messaging.test.*
Regression → tests/regression/EPIC-G/EPIC-G-repair-emergency.regression.test.*
A11y    → tests/a11y/tenant-repair-form.spec.*
Visual  → tests/visual/repair-form-each-step.spec.*
```

## Dependencies

- EPIC-J (data requirements) — repair_requests, repair_files, repair_status_history, repair_messages, repair_categories, contractors entities.
- EPIC-K (interface capabilities) — repair-related capabilities.
- EPIC-N (security) — auth on the admin side; magic-link signing on the contractor side; GDPR consent on the public form.
- EPIC-M (design system) — tokens; multi-step form primitive.

## Open questions

1. Confirm the magic-link expiry policy for contractors (default: 14 days, refresh on access).
2. Confirm whether tenant SMS notifications are universal or only on emergency urgency.
3. Confirm the cap on file size and count per ticket (default: 10 files, 25 MB each).
4. Confirm escalation behaviour when no staff acknowledges an emergency within the SLA window (auto-escalate to branch manager? pager to on-call rota?).
