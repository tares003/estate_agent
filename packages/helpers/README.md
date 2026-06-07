# @estate/helpers

Cross-cutting runtime helpers that enforce three of the project's non-negotiables. (Mirrored by Python counterparts in `services/django` — state changes originate server-side; these cover the Next.js side + the shared contract.)

## Public surface

- `audit({ actor, action, entity, entity_id, diff })` — emits an `audit_logs` row. **Every state-changing capability must call it** (guard G4).
- `notify(event, payload)` — outbound notification emission per the master spec §H.13 matrix (routes to per-tenant SMTP / SMS / in-app per the matrix).
- `recordConsent(scope, payload)` — records a consent timestamp on personal-data form submission (guard G5; `PRODUCT.md` §6).

## Telemetry

`audit()` and form helpers also emit the structured analytics events required by `_cross-cutting.md` §7 (`subject.verb` event names, e.g. `property.published`, `enquiry.submitted`).

## Discipline

100% line + branch coverage; integration tests assert the audit/consent rows actually land and that notification routing respects pack entitlement + per-tenant config. Coverage gate: **100% line + branch**.

Status: **skeleton** — built in Phase B2 (EPIC-N foundation).
