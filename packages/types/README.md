# @estate/types

Canonical TypeScript type definitions for **every entity in master spec §J**. Consumed by `apps/next`, `packages/validators`, `packages/api-client` and the UI.

## Public surface

One type/interface per §J entity, named with the **canonical nouns from `PRODUCT.md` §2** (enforced by guard G6). Covers: auth & access (§J.1), branches & agents (§J.2), property catalogue (§J.3/F), leads & CRM (§J.4), contacts (§J.5), repairs (§J.6/G), content (§J.7), and the cross-cutting `audit_logs`, `notification_log`, `consent_logs`, `settings`, `search_logs`, plus `tenants.enabled_packs` (EPIC-AD §J.1 amendment).

## Relationship to the API contract

These types are the **shape**; runtime validation lives in `@estate/validators`; the wire contract is the Django OpenAPI spec. A CI step verifies these three stay consistent.

## Discipline

Type-level tests (`tsd` / `expect-type`) assert structural guarantees and that fixtures conform. Coverage gate: **100%** (type guards / helpers).

Status: **skeleton** — built in Phase B2 alongside the §J migrations (Sprint-01 item 1).
