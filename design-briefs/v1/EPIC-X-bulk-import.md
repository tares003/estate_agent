# EPIC-X — Bulk import and data migration (design)

**Dev brief:** [dev-briefs/v1/EPIC-X-bulk-import.md](../../dev-briefs/v1/EPIC-X-bulk-import.md).
**Master spec reference:** Section H.22.
**Pack:** `bulk_import` (add-on; often a one-off engagement at signup).
**Status:** DEFERRED to Phase 8.

## Surfaces affected

- Admin → Properties → "Import properties" CTA.
- Import wizard (4 steps: Upload → Map → Preview → Run).
- Import history table.
- Scheduled-feed configuration screen.
- Per-run error report download.

## Layout patterns

### Import wizard

A multi-step modal or full-page flow following the EPIC-L MultiStepForm pattern.

- **Step 1 — Upload.** File-dropzone for CSV / XML. File-size and type validation inline. Once accepted, show file name and size, with "Replace" affordance.
- **Step 2 — Map.** Detected columns on the left, canonical attributes on the right, with auto-mapping pre-filled where the source matches a preset (Reapit, Alto, Jupix, Vebra, Rex). Required mappings flagged. Unmapped columns greyed out. "Save mapping for next time" toggle.
- **Step 3 — Preview.** Dry-run results: total records, sample first ten rows mapped to canonical attributes, validation errors per row, import-mode chooser (Dry-run only / Create only / Upsert match on reference / Upsert match on external_id).
- **Step 4 — Run.** Confirmation: "About to import X records into your catalogue", quota check ("Your plan allows Y active listings; this will bring you to Z"). Primary action: "Start import". Secondary: "Cancel and review".

### Import history table

- Columns: started, finished, user, source, mode, in / created / updated / skipped / failed, error report link.
- Row click expands to show the per-row failure summary.

### Scheduled-feed configuration

- Per-tenant list of configured feeds.
- Each feed: source URL (masked credentials), cadence, last run, last outcome.
- Add-feed CTA opens a form for source type, credentials, format, mapping preset, schedule.

### Error report

- Downloadable as CSV.
- Columns: source row number, source row content, validation reason, suggested fix.

## Component inventory

`ImportWizard` (steps 1-4), `ColumnMappingEditor`, `ImportPreviewTable`, `ImportRunSummary`, `ImportHistoryTable`, `ScheduledFeedConfigForm`, `ImportErrorReportPreview`. All built on the EPIC-L primitives.

## State variations

- **No imports yet:** "You haven't imported any properties yet" with a "Start import" CTA and a link to the CRM-migration guide.
- **Upload too large:** inline error with size limit reminder and an "Use scheduled feed instead" CTA.
- **Mapping incomplete:** "Next" disabled until every required canonical attribute has a source column mapped.
- **Validation errors > 0 in preview:** "Continue with X failed rows" CTA and "Cancel and fix source" CTA, side by side.
- **Quota would be exceeded:** modal block on Run step with upgrade-plan link.
- **Import in progress:** non-blocking toast that links to a progress page; user can navigate away and come back.
- **Import complete:** success page summarising counts, "Download error report" CTA if any failed rows.

## Accessibility specifics

- Stepper announces "Step X of 4, [step name]" via `aria-current`.
- Column-mapping editor is keyboard-operable (left/right arrows swap focused source ↔ canonical pair).
- Preview table announces row counts and error counts via `aria-live`.

## Responsive

- Wizard on mobile: each step becomes its own screen with a back-button.
- Column-mapping editor on mobile: shows source columns as a vertical list with inline canonical-attribute pickers.

## Motion

- Stepper progress updates per `motion-spec.md` Stepper rules.
- Import-progress toast pulses subtly until completion.

## Token references

- Validation error count: `--colour-danger` background pill.
- Success count: `--colour-success` background pill.
- Skipped count: `--colour-text-muted` pill.

## Open design questions

1. Confirm whether the column-mapping editor allows multiple source columns to map to one canonical attribute (e.g. concatenated description fields).
2. Confirm the visual treatment of preset mappings — automatic match indicator vs explicit "Reapit preset applied" badge.
3. Confirm whether scheduled feeds expose a "run now" button in the admin or only via the worker console (recommended: both).
