# EPIC-AA — Tenant portal

**Master spec reference:** Section J.5 (tenants entity), Section G (repairs), Section C.16 (existing repair page).
**Pack:** Core (Lettings is part of core per PRODUCT.md §5).
**Status:** NOT_STARTED.
**Paired design brief:** [design-briefs/v1/EPIC-AA-tenant-portal.md](../../design-briefs/v1/EPIC-AA-tenant-portal.md).

## Purpose

A self-service portal where a current tenant can sign in and see their tenancy details, lodge repairs (already covered in EPIC-G — this brief surfaces it), pay rent via the configured rent-collection product, see inspection history, and prepare for end-of-tenancy. Standard feature in real lettings agencies; cuts inbound queries about deposit, lease end date, what's due.

## Functional requirements

- **FR-AA-1.** A tenant shall sign in via the same magic-link mechanism as the vendor and landlord portals (EPIC-Y FR-Y-1). Auth foundations are shared; authorisation scopes are separate.
- **FR-AA-2.** A tenant shall see their current tenancy details: property address, tenancy start date, tenancy end date or rolling-monthly indicator, monthly rent, rent payment day, deposit amount with deposit-protection scheme reference and lodging date, guarantor name (where applicable).
- **FR-AA-3.** A tenant shall see their rent payment status: amount due this month, amount received, due date, payment method, link out to the chosen rent-collection product per `PRODUCT.md` §9.
- **FR-AA-4.** A tenant shall see their rent payment history (last 12 months) with date, amount, status.
- **FR-AA-5.** A tenant shall be able to raise a new repair from the portal, which deep-links into the EPIC-G repair form pre-filled with their property address and tenant details. The form needs only the issue category, description, urgency, photos and access permission.
- **FR-AA-6.** A tenant shall see their open repair tickets with current status, assigned contractor and ETA where available.
- **FR-AA-7.** A tenant shall see their inspection history: scheduled and past inspections with date, type (mid-tenancy, end-of-tenancy, gas safety, EICR, mid-term review), outcome notes and photos where shared.
- **FR-AA-8.** A tenant shall see compliance certificates that are required to be shared with them under the Tenant Fees Act and related regulations: EPC, gas safety, How-To-Rent guide, EICR. Each as a downloadable PDF.
- **FR-AA-9.** A tenant shall be able to message the assigned property manager through the portal. Messages thread alongside the tenant's contact record.
- **FR-AA-10.** A tenant within 60 days of their tenancy end date shall see a renewal panel: agency's proposed terms (if any), accept / decline actions, or a "give notice" flow.
- **FR-AA-11.** A tenant intending to leave shall be able to start an end-of-tenancy checklist: notice given date, intended departure date, deposit return preferences, forwarding address.
- **FR-AA-12.** A tenant who has left a property shall retain portal access for 90 days post-tenancy-end to retrieve documents and statements. After 90 days, access is revoked and personal data is subject to retention rules.

## User stories

- As a tenant, I want to find my deposit-protection certificate without searching three years of emails.
- As a tenant who broke their boiler, I want to raise a repair from my phone in under two minutes.
- As a tenant whose tenancy is ending, I want to see the agency's renewal proposal and accept it from the portal without scheduling a meeting.
- As a leaving tenant, I want to see what I need to do to get my deposit back.

## Acceptance criteria

- A tenant can sign in via magic link in under 60 seconds.
- Lodging a repair from the tenant portal pre-fills the form and reduces the steps the tenant has to fill in.
- Rent payment status reflects external rent-collection product state with at most one hour of delay.
- Compliance certificates are downloadable as PDFs.
- A tenant whose tenancy has ended retains 90 days of read-only access.
- Cross-tenant authorisation is enforced at the data layer — a tenant cannot see another tenant's data even if they share an address.

## Test mapping

```
FR-AA-1  → shares with EPIC-Y: tests/integration/portal-magic-link.test.* (tenant scope)
FR-AA-2  → tests/integration/tenant-tenancy-details.test.*
FR-AA-3  → tests/integration/tenant-rent-status.test.*
FR-AA-4  → tests/integration/tenant-rent-history.test.*
FR-AA-5  → tests/integration/tenant-repair-pre-fill.test.*
FR-AA-6  → tests/integration/tenant-open-repairs.test.*
FR-AA-7  → tests/integration/tenant-inspection-history.test.*
FR-AA-8  → tests/integration/tenant-compliance-certificates.test.*
FR-AA-9  → tests/integration/tenant-pm-messaging.test.*
FR-AA-10 → tests/integration/tenant-renewal-flow.test.*
FR-AA-11 → tests/integration/tenant-end-of-tenancy.test.*
FR-AA-12 → tests/integration/tenant-post-tenancy-access.test.*
A11y     → tests/a11y/tenant-portal.spec.*
Security → tests/security/tenant-cross-tenant-isolation.test.*
```

## Dependencies

- EPIC-J — `tenants`, `tenancies`, `properties`, `property_documents`.
- EPIC-G — the repair form, repair status feed.
- EPIC-N — magic-link auth, audit log.
- External rent-collection product per `PRODUCT.md` §9 (the platform surfaces its status, doesn't process payment).
- External deposit-protection scheme per `PRODUCT.md` §9.

## Open questions

1. Confirm whether the tenant portal supports multi-tenant tenancies (joint tenants) — both signed in independently to the same tenancy (recommended: yes, V1).
2. Confirm the V1 scope of the end-of-tenancy checklist (recommended: notice date + forwarding address + deposit return preferences + checklist of things tenant should do).
3. Confirm whether tenants can request a "rent statement" PDF on demand (recommended: yes).
4. Confirm whether mid-tenancy rent-arrears communications happen via the portal or via the existing email/SMS notifications (recommended: both, with portal showing status mirror).
5. Confirm whether tenants can update their forwarding address themselves or only via the property manager (recommended: tenant updates, agency reviews).
