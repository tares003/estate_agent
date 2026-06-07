# EPIC-Y — Vendor (seller) portal

**Master spec reference:** Section J.5 (vendors entity), Section B.36 (reviews); new surface — not previously enumerated in the master spec.
**Pack:** `sales_plus` (add-on; included with Professional and Enterprise tiers).
**Status:** NOT_STARTED.
**Paired design brief:** [design-briefs/v1/EPIC-Y-vendor-portal.md](../../design-briefs/v1/EPIC-Y-vendor-portal.md).

## Purpose

A self-service portal where a vendor (a property seller, in UK estate-agency terminology) can sign in and see, for each of their properties on the market: views and engagement, enquiries received, viewings booked and outcomes, viewing feedback, offers received and their statuses, days on market vs comparable properties, and the marketing the agency is doing on their behalf (photos, video, brochure). This is a major commercial differentiator — agencies offering it close more instructions because vendors get transparency without having to call the agent.

## Functional requirements

- **FR-Y-1.** A vendor shall be able to sign in to the portal using their email address and a one-time link sent to that email. The link signs them in for a configurable session duration (default: 30 days). Password-based sign-in is optional in V1 (recommended: not in V1).
- **FR-Y-2.** A vendor shall see a list of every property they are the vendor of (the `vendors.property_id` linkage), filtered to active and recently-completed listings (last 90 days).
- **FR-Y-3.** For each property a vendor shall see: marketing assets (photos, floorplan, EPC, brochure, video, virtual tour), public listing URL, current market status, list price and any price changes with reasons.
- **FR-Y-4.** For each property a vendor shall see engagement metrics: total page views over time (chart), saved-to-favourites count, brochure downloads count, share clicks count. Metrics are aggregated and exclude bot traffic.
- **FR-Y-5.** For each property a vendor shall see every enquiry received with name (or "anonymous applicant" if the agency policy redacts identities), date, channel (form / phone / email forwarded), and a status (responded, in conversation, viewing booked, closed).
- **FR-Y-6.** For each property a vendor shall see every viewing with date, time, applicant, outcome (confirmed, attended, no-show, cancelled), and post-viewing feedback (collected via EPIC-AC) when available.
- **FR-Y-7.** For each property a vendor shall see every offer received with the amount, the applicant's position (chain-free, in chain, cash buyer, first-time buyer), the agent's recommendation, and the current acceptance state (open, accepted, declined, withdrawn).
- **FR-Y-8.** A vendor shall be able to indicate acceptance, rejection or a counter-offer through the portal. The action notifies the assigned agent and writes an audit-log entry.
- **FR-Y-9.** A vendor shall be able to message the assigned agent through the portal. Messages thread alongside the property's enquiry record.
- **FR-Y-10.** A vendor shall be able to download a monthly "vendor report" PDF summarising marketing activity, engagement and viewings for the previous month.
- **FR-Y-11.** A vendor shall see comparison data: days on market for their property vs the configured comparable-properties set, weekly enquiry rate vs comparable. Comparable selection is agency-curated.
- **FR-Y-12.** A vendor shall see the agency's stated marketing plan for their property (campaigns running, social posts published, portal syndication status from EPIC-V).

## User stories

- As a seller, I want to know how many people viewed my listing this week without phoning my agent.
- As a seller weighing an offer, I want to see all offers side-by-side and respond from the portal.
- As an anxious vendor at week 8 with no offers, I want to see whether my property's engagement is below the comparable set, so I can have an informed conversation about price.
- As an agent, I want vendors to self-serve their updates so I can spend my time selling.

## Acceptance criteria

- A vendor can sign in via email link in under 60 seconds.
- Engagement metrics update at least daily.
- Offer responses (accept, reject, counter) reach the agent in real time and write an audit-log entry.
- The monthly vendor report PDF generates within 10 seconds and contains every required section.
- A vendor cannot see properties for which they are not the linked vendor (per-vendor authorisation at the data layer).

## Test mapping

```
FR-Y-1  → tests/integration/vendor-magic-link.test.*, tests/e2e/vendor-sign-in.spec.*
FR-Y-2  → tests/integration/vendor-property-list-scoping.test.*
FR-Y-3  → tests/integration/vendor-marketing-assets.test.*
FR-Y-4  → tests/integration/vendor-engagement-metrics.test.*
FR-Y-5  → tests/integration/vendor-enquiries-feed.test.*
FR-Y-6  → tests/integration/vendor-viewings-feed.test.*
FR-Y-7  → tests/integration/vendor-offers-feed.test.*
FR-Y-8  → tests/integration/vendor-offer-response.test.*
FR-Y-9  → tests/integration/vendor-agent-messaging.test.*
FR-Y-10 → tests/integration/vendor-monthly-report-pdf.test.*
FR-Y-11 → tests/integration/vendor-comparables.test.*
FR-Y-12 → tests/integration/vendor-marketing-plan.test.*
A11y    → tests/a11y/vendor-portal.spec.*
Visual  → tests/visual/vendor-portal.spec.*
Security → tests/security/vendor-cross-property-isolation.test.* (vendor cannot read another vendor's data)
```

## Dependencies

- EPIC-J — `vendors`, `properties`, `enquiries`, `viewing_requests`, plus a new `offers` entity (to be added in PHASE B migration scope).
- EPIC-N — magic-link signing; audit log; rate-limiting on the sign-in endpoint.
- EPIC-AC — viewing feedback collection (FR-Y-6 surfaces feedback from there).
- EPIC-V — portal syndication status surface in FR-Y-12.

## Open questions

1. Confirm whether agency policy allows revealing applicant names to vendors by default (recommended: configurable per agency, default redacted).
2. Confirm whether vendors can see offers from other applicants when one is accepted (recommended: yes, but rejected offers anonymised).
3. Confirm the V1 scope of the "marketing plan" surface — read-only display vs editable check-list with completion dates.
4. Confirm whether the offers entity needs a separate dev brief or can be folded into EPIC-Y.
5. Confirm the comparable-properties algorithm (recommended V1: agency-curated set per property, not automatic).
