# EPIC-Z — Landlord portal

**Master spec reference:** Section J.5 (landlords entity), Section G (repairs), Section H.9 (compliance items).
**Pack:** Core (Lettings is part of core per PRODUCT.md §5).
**Status:** NOT_STARTED.
**Paired design brief:** [design-briefs/v1/EPIC-Z-landlord-portal.md](../../design-briefs/v1/EPIC-Z-landlord-portal.md).

## Purpose

A self-service portal where a landlord (a property owner letting through the agency) can sign in and see their managed-portfolio status. Standard feature in real lettings agencies. Cuts inbound calls noticeably and gives landlords confidence in full-management services.

## Functional requirements

- **FR-Z-1.** A landlord shall sign in via the same magic-link mechanism as the vendor portal (EPIC-Y FR-Y-1). Both portals share the auth foundation but have separate authorisation scopes.
- **FR-Z-2.** A landlord shall see a list of every property they own (the `landlords.property_id` linkage), filtered to actively-managed properties and properties whose tenancy ended within the last 12 months.
- **FR-Z-3.** For each managed property a landlord shall see: current tenancy (tenant name with agency policy controlling disclosure, tenancy start and end date, monthly rent, deposit lodged with scheme reference), property condition snapshot, marketing assets if currently available for let.
- **FR-Z-4.** For each property a landlord shall see rent collection status month-by-month: amount due, amount received, date received, outstanding balance, late-payment flags.
- **FR-Z-5.** For each property a landlord shall see every repair ticket (per EPIC-G) with current status, assigned contractor, photos and cost estimates / actuals.
- **FR-Z-6.** A landlord shall see a compliance dashboard per property: gas safety certificate (issue date, expiry), EICR (issue date, expiry), EPC (rating, expiry), deposit-protection-scheme reference and lodging date, Right-to-Rent check date. Each item shows green / amber / red against expiry. Amber when within 30 days of expiry; red after.
- **FR-Z-7.** A landlord shall be able to download a monthly statement PDF summarising rent collected, fees deducted, repairs charged, and amount paid out.
- **FR-Z-8.** A landlord shall be able to approve or decline repairs above the configured per-tenant or per-tenancy approval threshold. The decision notifies the property manager and writes an audit-log entry.
- **FR-Z-9.** A landlord shall be able to message the assigned property manager through the portal. Messages thread alongside the property's owner record.
- **FR-Z-10.** A landlord shall see tenancy renewal status: notice given by either party, proposed renewal terms, signed renewal documents.
- **FR-Z-11.** A landlord whose property is between tenancies shall see the re-letting pipeline: marketing live, applicants in conversation, viewings booked, applications received and their referencing status (status only — referencing details defer to the specialist tenant-referencing product per `PRODUCT.md` §9).
- **FR-Z-12.** A landlord shall see year-to-date and lifetime totals: total rent received, total fees paid to the agency, total repair spend.

## User stories

- As a landlord with three properties, I want to see the gas safety expiry status for all three at a glance.
- As a landlord on a beach in another country, I want to approve a £450 boiler repair without phoning the office.
- As a landlord deciding whether to renew with this agency, I want to see twelve months of statements without asking for them.
- As a property manager, I want landlords to self-approve routine repairs so I'm not phoning them three times a week.

## Acceptance criteria

- A landlord can see every managed property, every tenancy, every repair, and every compliance item across all their properties in two screens.
- An approve / decline action on a repair reaches the property manager in real time and writes an audit-log entry.
- The monthly statement PDF reconciles to the underlying rent and fees records exactly.
- A compliance item changing from amber to red triggers an alert email to the landlord.
- Cross-landlord authorisation is enforced at the data layer — a landlord cannot see another landlord's data.

## Test mapping

```
FR-Z-1  → shares with EPIC-Y: tests/integration/portal-magic-link.test.* (landlord scope)
FR-Z-2  → tests/integration/landlord-property-list-scoping.test.*
FR-Z-3  → tests/integration/landlord-tenancy-details.test.*
FR-Z-4  → tests/integration/landlord-rent-collection-status.test.*
FR-Z-5  → tests/integration/landlord-repairs-feed.test.*
FR-Z-6  → tests/integration/landlord-compliance-dashboard.test.*
FR-Z-7  → tests/integration/landlord-monthly-statement-pdf.test.*
FR-Z-8  → tests/integration/landlord-repair-approval.test.*
FR-Z-9  → tests/integration/landlord-pm-messaging.test.*
FR-Z-10 → tests/integration/landlord-renewal-status.test.*
FR-Z-11 → tests/integration/landlord-reletting-pipeline.test.*
FR-Z-12 → tests/integration/landlord-totals.test.*
A11y    → tests/a11y/landlord-portal.spec.*
Security → tests/security/landlord-cross-landlord-isolation.test.*
```

## Dependencies

- EPIC-J — `landlords`, `properties`, `tenants`, plus new `tenancies` and `rent_collections` entities (PHASE B migration scope).
- EPIC-G — repairs feed.
- EPIC-N — magic-link auth, audit log.
- EPIC-AC — viewing feedback during re-letting pipeline.
- External rent-collection product per `PRODUCT.md` §9 (out of scope but the portal surfaces its status).

## Open questions

1. Confirm the configurable repair-approval threshold per landlord (recommended: per-landlord setting with a per-property override).
2. Confirm the default disclosure of tenant identity to landlord (recommended: full name + first line of contact, not full contact details).
3. Confirm whether the renewal flow includes the landlord being able to set proposed renewal terms (recommended: yes, with property-manager review before sending to tenant).
4. Confirm the format of the monthly statement PDF (recommended: a standard line-item layout with totals, agency-branded).
