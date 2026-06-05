# EPIC-I — CRM and lead workflow

**Master spec reference:** Section I (I.1–I.5).
**Status:** NOT_STARTED.
**Paired design brief:** [design-briefs/v1/EPIC-I-crm-workflow.md](../../design-briefs/v1/EPIC-I-crm-workflow.md).

## Purpose

Implement the unified lead pipeline: one enquiry entity, twelve lead types, eight statuses, configurable assignment rules, SLA enforcement, and built-in reporting.

## Functional requirements

- **FR-I-1.** Every public form on the site shall produce an enquiry record with the correct `lead_type` per master spec Section I.1.
- **FR-I-2.** An enquiry's lifecycle shall follow the status workflow in master spec Section I.3 (new → contacted → viewing_booked / valuation_booked / waiting_for_response → converted / lost → archived).
- **FR-I-3.** Assignment rules shall be admin-configurable per master spec Section I.4 and shall be evaluated top-down with first-match-wins semantics.
- **FR-I-4.** SLA targets shall be set per lead type and per priority via configuration. The dashboard, alerts and timeline badges shall be driven by this configuration.
- **FR-I-5.** Threaded notes shall be supported on every enquiry with an "is internal" flag controlling visibility in client-facing communications.
- **FR-I-6.** Enquiry conversion shall produce a Buyer / Tenant / Vendor / Landlord contact record linked back to the originating enquiry.
- **FR-I-7.** Every state-changing CRM action shall write an audit-log entry.
- **FR-I-8.** Bulk operations (bulk assign, bulk change status, bulk priority, bulk note, bulk archive, bulk export) shall be available on the queue with role-gated access.
- **FR-I-9.** Saved views (filter + sort + columns + name) shall persist per user and shall optionally be shared to a branch or to the whole agency.
- **FR-I-10.** Reports (master spec Section I.5) shall be available with date-range, branch, agent and source filters.

## User stories

- As a sales agent, I want every public form submission about my own properties to be routed automatically to me, so I do not have to triage.
- As a lettings manager, I want a saved view of unassigned tenant enquiries in my branch over the past 48 hours, so I can clear the backlog daily.
- As a marketing manager, I want a leads-by-source report so I can decide which advertising channels deserve more budget.
- As a branch manager, I want to know when any of my team's leads breach the response-time SLA.

## Acceptance criteria

- Every public form path produces a queue entry with the correct lead type and source attribution within five seconds of submission.
- The first-contact response time is tracked accurately per lead.
- Assignment rules can be reordered and tested against a sample lead without persisting.
- Bulk operations succeed atomically (either every selected lead transitions or none does).
- Saved views reload exactly as saved, including column order and width.

## Test mapping

```
FR-I-1  → tests/integration/enquiry-lead-type-mapping.test.* (one per form path)
FR-I-2  → tests/integration/enquiry-status-workflow.test.*
FR-I-3  → tests/integration/assignment-rules-engine.test.*
FR-I-4  → tests/integration/sla-configuration.test.*
FR-I-5  → tests/integration/enquiry-notes.test.*
FR-I-6  → tests/integration/enquiry-conversion.test.*
FR-I-7  → tests/integration/enquiry-audit-log.test.*
FR-I-8  → tests/integration/enquiry-bulk-operations.test.*
FR-I-9  → tests/integration/saved-views.test.*
FR-I-10 → tests/integration/crm-reports.test.* (per pre-built report)
```

## Dependencies

- EPIC-J (data) — enquiries, enquiry_notes, viewing_requests, valuation_requests.
- EPIC-H (admin) — the queue and detail surfaces.
- EPIC-N (security) — RBAC per role.
- EPIC-C / EPIC-G — public forms that produce enquiries.

## Open questions

1. Confirm whether bulk-reply (with template) is in V1 scope (recommended: no, to avoid template-spam risk).
2. Confirm the policy on enquiry deduplication when the same applicant submits twice within a short window.
3. Confirm the assignment-rule cascade for repair_request when the property has no assigned agent.
