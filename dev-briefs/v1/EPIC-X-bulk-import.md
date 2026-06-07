# EPIC-X — Bulk import and data migration

**Master spec reference:** Section H.22 (Imports / Exports), Section B.54 (Bulk property import).
**Status:** NOT_STARTED. **Phase: deferred to Phase 8 of the build roadmap.**
**Paired design brief:** [design-briefs/v1/EPIC-X-bulk-import.md](../../design-briefs/v1/EPIC-X-bulk-import.md).

## Purpose

Implement bulk import of properties (and supporting entities) from CSV / XML uploads and from scheduled feeds out of established UK estate-agency CRMs (Reapit, Alto, Jupix, Vebra, Rex, Street, Yardi and equivalents). A new agency signing up will almost always have an existing catalogue elsewhere; without bulk import they have no migration path onto the platform.

## Functional requirements

- **FR-X-1.** A staff user with `property.import` permission shall be able to upload a CSV or XML file from the admin and start a bulk import.
- **FR-X-2.** The importer shall parse the upload and present a dry-run preview showing: total records detected, sample of the first ten records mapped to canonical attributes, validation errors per row, and the import-mode choice (dry-run, create-only, upsert).
- **FR-X-3.** Field mapping shall be configurable. The importer shall provide preset mappings for the major UK CRMs (Reapit, Alto, Jupix, Vebra and equivalents) and shall allow user-defined column-to-attribute mappings for custom CSVs.
- **FR-X-4.** Upsert mode shall match incoming records to existing records on `reference` or on `external_id`. The user shall choose which field to match on.
- **FR-X-5.** A row that fails validation in upsert mode shall not break the whole import — the import continues, the row is logged with the validation reason, and a downloadable error report is produced at the end.
- **FR-X-6.** Import results shall be stored in `import_logs` per master spec Section J.7, with counts (in / created / updated / skipped / failed) and an error summary.
- **FR-X-7.** A scheduled-feed import shall be configurable per tenant: source type (FTP / SFTP / HTTPS / S3), credentials (masked), cadence (default: hourly), feed format, and field mapping.
- **FR-X-8.** A scheduled feed shall execute via the worker layer (EPIC-U) with the standard retry policy.
- **FR-X-9.** Bulk import shall observe the audit-log rule — one audit entry per import run, plus one per failed row.
- **FR-X-10.** A bulk import shall not exceed the tenant's plan quota for active listings (`PRODUCT.md` §5). An import that would exceed the quota is aborted with a clear "Quota would be exceeded" error.
- **FR-X-11.** Imported property images shall be re-processed (EXIF stripped, variants generated) via the standard image post-processing worker.

## User stories

- As a sales agent migrating from Reapit, I want my 350 active listings on the platform within an afternoon, not a fortnight.
- As a property manager whose office uses Jupix, I want a nightly feed that keeps the platform in sync without manual work.
- As a content editor, I want a clear error report when a CSV has bad data so I can fix the source rather than dropping the records.
- As an admin importing for the first time, I want a dry-run preview so I can spot mapping problems before I create 200 incorrect records.

## Acceptance criteria

- A representative Reapit CSV imports cleanly using the preset Reapit mapping with zero manual configuration.
- A row with a missing `price` is rejected with a clear validation reason and the import continues.
- Re-running the same import in upsert mode does not create duplicates.
- An import that would exceed the plan quota is aborted before any records are created.
- The error report is downloadable as a CSV.
- The audit log records the import run with the actor and a summary of counts.

## Test mapping

```
FR-X-1  → tests/integration/import-upload.test.*
FR-X-2  → tests/integration/import-dry-run-preview.test.*
FR-X-3  → tests/integration/import-preset-mappings.test.* (one per known CRM)
FR-X-4  → tests/integration/import-upsert.test.* (matching on reference + on external_id)
FR-X-5  → tests/integration/import-row-failure-isolation.test.*
FR-X-6  → tests/integration/import-logs.test.*
FR-X-7  → tests/integration/import-feed-config.test.*
FR-X-8  → tests/integration/import-feed-worker.test.* (also referenced by EPIC-U)
FR-X-9  → tests/integration/import-audit-log.test.*
FR-X-10 → tests/integration/import-quota-enforcement.test.*
FR-X-11 → tests/integration/import-image-postprocess.test.*
Regression → tests/regression/EPIC-X/EPIC-X-upsert-no-duplicates.regression.test.*
```

## Dependencies

- EPIC-J — `import_logs`, `properties`, `property_images`, `property_documents`.
- EPIC-F — property creation and the publish pre-flight checklist (which must be satisfiable on imported data).
- EPIC-N — role permission `property.import`; audit logging.
- EPIC-U — the scheduled-feed worker.
- EPIC-H — the admin UI surfaces for import upload, preview, configuration and history.

## Open questions

1. Confirm the V1 list of CRM preset mappings (recommended: Reapit, Alto, Jupix, Vebra, Rex; defer additional).
2. Confirm the policy on importing properties whose `assigned_agent` is not present in the tenant's agents (recommended: fall back to a default agent and flag for follow-up).
3. Confirm whether bulk import of contacts (landlords, tenants, vendors, buyers) is in this brief or split into a follow-on.
4. Confirm the maximum file size per upload (recommended: 50 MB; larger imports use scheduled feeds).
5. Confirm whether the importer supports incremental imports (only changed records since last run) for scheduled feeds.
