# EPIC-A — Executive summary and architectural direction

**Master spec reference:** Section A.
**Status:** CONTEXT (no implementation work).
**Paired design brief:** [design-briefs/v1/EPIC-A-executive-summary.md](../../design-briefs/v1/EPIC-A-executive-summary.md).

## Purpose

This epic is informational. It carries the executive summary and the architectural decisions that every other epic must respect. The autonomous build agent should read this brief before starting any other epic, but it does not implement code from this brief directly.

## What this epic establishes

- The platform's seven logical surfaces: portal marketing site, unified property catalogue, customer accounts, admin dashboard, repair reporting, CRM, and headless CMS.
- The non-negotiable architectural rules:
  - One property entity discriminated by listing type — not one table per vertical.
  - One enquiry entity discriminated by lead type — not one table per form.
  - Page-builder CMS — not hard-coded marketing pages.
  - Federation-friendly design that allows individual modules to be swapped for established third-party products.
  - Implementation-neutral interface contracts.
- The explicit out-of-scope list: mortgage origination, financial advice, tenancy contract generation, payments, AML, conveyancing.

## How other epics use this brief

- EPIC-F (property data) inherits the "one entity, listing-type discriminator" decision.
- EPIC-I (CRM) inherits the "one enquiry, lead-type discriminator" decision.
- EPIC-D (CMS) inherits the page-builder decision.
- EPIC-K (capabilities) inherits the implementation-neutral contracts decision.
- EPIC-S (hosting) inherits the federation-friendly design.

## Acceptance

The architectural rules in master spec Section A appear, verbatim or referenced, in every relevant epic brief. Drift from these rules is rejected at audit.

## Dependencies

None.

## Open questions

None at this level. Open questions specific to individual epics live in their own briefs.
