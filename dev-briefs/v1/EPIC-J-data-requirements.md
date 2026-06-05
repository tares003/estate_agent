# EPIC-J — Data requirements (entities and attributes)

**Master spec reference:** Section J (J.1–J.9).
**Status:** NOT_STARTED.
**Paired design brief:** [design-briefs/v1/EPIC-J-data-requirements.md](../../design-briefs/v1/EPIC-J-data-requirements.md).

## Purpose

Implement the complete entity model defined in master spec Section J — every table, every column, every relationship — as PHASE B (foundation) work. No consumer is wired in this epic; consumers land in their owning epic PRs.

## Functional requirements

- **FR-J-1.** Every entity in master spec Section J shall have a corresponding storage representation with every attribute described.
- **FR-J-2.** Every relationship described in master spec Section J.9 shall be enforced at the storage layer with referential integrity.
- **FR-J-3.** Indexes shall be created for the predicates listed in master spec Section J.7 (composite indexes on common search patterns, spatial index on latitude/longitude when the implementation supports it).
- **FR-J-4.** Every entity shall be exposed in the shared `types` package with a single canonical type per entity, derived from the storage schema.
- **FR-J-5.** Soft-deletion (`deleted_at` timestamp) shall be supported on properties, users, contacts and pages.
- **FR-J-6.** Universal identifiers shall be globally unique, non-sequential and unable to be enumerated.
- **FR-J-7.** Every entity that captures personal data shall declare its retention period and shall be subject to the automated retention purge job.

## Acceptance criteria

- Migrations apply cleanly on a fresh database and on a copy of a populated database.
- Every migration has a working down-migration verified by an automated test.
- The shared `types` package compiles and is consumed by both backend and frontend skeletons.
- A property created via the storage layer with every attribute populated round-trips losslessly through the type system.
- The retention purge job runs on schedule and produces expected anonymisation results against a controlled fixture.

## Test mapping

```
FR-J-1 → tests/integration/schema-presence.test.* (one per entity)
FR-J-2 → tests/integration/referential-integrity.test.*
FR-J-3 → tests/integration/indexes-present.test.*
FR-J-4 → tests/unit/types-package.test.*
FR-J-5 → tests/integration/soft-deletion.test.* (per soft-deletable entity)
FR-J-6 → tests/property/identifier-non-enumerable.test.* (property-based)
FR-J-7 → tests/integration/retention-purge.test.*
```

## Dependencies

None — this epic is foundation. Every other epic depends on it.

## Open questions

1. Confirm the choice between separate tables and one unified contact entity for landlords / tenants / vendors / buyers. Master spec presents both options; this brief defaults to separate tables but the team may revisit.
2. Confirm whether identifier format is UUIDv7 (sortable) or UUIDv4 (random).
3. Confirm the retention periods for low-value tables (`search_logs`, `consent_logs`, `notification_log` — recommended 13 months).
4. Confirm the policy on backfilling historical audit-log entries when the audit-log table is first introduced.
