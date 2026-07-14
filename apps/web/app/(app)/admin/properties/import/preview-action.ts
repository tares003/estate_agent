'use server';

import { detectCrmPreset, type PresetName } from '@estate/validators';
import { withTenant } from '@estate/db';
import type { FormErrorItem } from '@estate/ui';

import { getDb } from '../../../lib/db.js';
import { requireStaffPermission } from '../../../lib/staff-session.js';
import { getCurrentTenantId } from '../../../lib/tenant.js';
import { readActiveListingUsage } from '../../../lib/import-quota.js';
import {
  buildMatchIndex,
  formatRowError,
  importMatchField,
  parsePropertyImportCsv,
  planImportRows,
  type ExistingPropertyKey,
  type ImportColumn,
  type ImportMode,
  type PlannedRow,
  type ValidRow,
} from './csv-import-core.js';
import { readImportCsv, readImportMapping, readImportMode } from './read-csv.js';

// EPIC-X FR-X-2 — the DRY-RUN preview of a bulk CSV property import.
//
// The admin uploads a CSV; this action parses + validates EVERY row with the SAME pure
// `csv-import-core` the real import uses, then returns the outcome so the admin can spot
// mapping / data problems BEFORE committing: total records detected, valid / invalid
// counts, a sample of the first ten records mapped to canonical property attributes,
// the per-row validation errors, and which columns were recognised vs ignored.
//
// FR-X-2 / FR-X-4 — the preview also simulates the chosen import MODE with the SAME
// pure planner as the real import: it echoes the mode and reports what the confirmed
// run WOULD do (wouldCreate / wouldUpdate / wouldSkip). In an upsert mode that takes
// ONE tenant-scoped READ of the existing property identities; create-only needs no
// read at all.
//
// A dry run creates NOTHING. No property insert, no `import_logs` write and NO audit —
// reading + validating a file is not a state change, so the G4 audit rule does not
// apply here (the audited write happens later, when the admin confirms and
// `importPropertiesFromCsv` runs). RBAC is still fail-closed on the same
// `property.import` permission the real import gates on (FR-X-1), so a user who could
// not import also cannot preview.

/** How many mapped records the preview surfaces (FR-X-2: "the first ten records"). */
export const PREVIEW_SAMPLE_LIMIT = 10;

/** The in / valid / invalid tally shown above the preview. */
export interface ImportPreviewCounts {
  /** Total DATA rows detected in the upload (excludes the header). */
  input: number;
  /** Rows that validated cleanly. */
  valid: number;
  /** Rows that failed validation. */
  invalid: number;
}

/**
 * One mapped record in the preview sample — the canonical property attributes a content
 * editor recognises, so they can confirm the columns mapped correctly. A projection of
 * the validated row, not the full record (the preview is a spot-check, not the import).
 */
export interface ImportPreviewSampleRow {
  reference: string;
  displayAddress: string;
  price: number | null;
  listingType: string;
}

/**
 * The plan-quota outcome for this upload (FR-X-10), so the admin sees whether the
 * import fits BEFORE committing. `limit` is Infinity for an enterprise (unlimited)
 * tenant, in which case `wouldExceed` is always false.
 */
export interface ImportPreviewQuota {
  /** The plan-tier active-listing cap (Infinity for enterprise). */
  limit: number;
  /** The tenant's current active (publicly live) listings. */
  existingActive: number;
  /**
   * NET-NEW published rows: planned CREATES with publicationStatus=published. Drafts
   * never consume the ACTIVE cap, and upsert UPDATES are never net-new (FR-X-10) —
   * re-previewing an already-imported file shows zero incoming.
   */
  incoming: number;
  /** Whether committing this upload would push the tenant past the cap. */
  wouldExceed: boolean;
  /** Headroom left after a within-quota import (0 when at/over the cap). */
  remainingAfterImport: number;
}

/** FR-X-2 / FR-X-4 — what the confirmed run WOULD do with the valid rows, per mode. */
export interface ImportPreviewOutcome {
  /** Valid rows that would CREATE a new listing. */
  wouldCreate: number;
  /** Valid rows that would UPDATE the listing they matched (upsert mode). */
  wouldUpdate: number;
  /** Valid rows that would be SKIPPED (upsert on external id, row carries none). */
  wouldSkip: number;
}

/** The dry-run outcome surfaced to the admin. */
export interface ImportPreview {
  counts: ImportPreviewCounts;
  /** The first ten valid records mapped to canonical attributes. */
  sample: ImportPreviewSampleRow[];
  /** One human-readable line per invalid row (same format as the import error report). */
  errors: string[];
  /** Recognised headers actually present in the file. */
  recognisedColumns: ImportColumn[];
  /** Headers present in the file the importer does not recognise (ignored). */
  ignoredColumns: string[];
  /**
   * The CRM preset auto-detected from the upload's headers (FR-X-3), or `null` when no
   * preset matched (a canonical CSV, or a bespoke export the admin maps by hand). The
   * form uses this to pre-select the mapping. Detection runs on the RAW headers, so it
   * still suggests a preset even when the current preview used a custom mapping.
   */
  detectedPreset: PresetName | null;
  /** FR-X-2 — the import mode this preview simulated (echoed from the form). */
  mode: ImportMode;
  /** FR-X-2 / FR-X-4 — what the confirmed run WOULD do with the valid rows. */
  outcome: ImportPreviewOutcome;
  /**
   * FR-X-10 — the plan-quota outcome for this upload, so the admin sees the cap, the
   * current active count and whether committing would exceed it BEFORE running the
   * import. Absent only when the quota could not be read (best-effort; the real
   * import still enforces the cap authoritatively).
   */
  quota?: ImportPreviewQuota;
}

/** The result of a preview, consumed by `useActionState`. */
export interface ImportPreviewState {
  ok: boolean;
  errors?: FormErrorItem[];
  preview?: ImportPreview;
}

function deny(message: string): ImportPreviewState {
  return { ok: false, errors: [{ message }] };
}

/** Project a validated row down to the canonical attributes the preview sample shows. */
function toSampleRow(row: ValidRow): ImportPreviewSampleRow {
  return {
    reference: row.data.reference,
    displayAddress: row.data.displayAddress,
    price: row.data.price ?? null,
    listingType: row.data.listingType,
  };
}

export async function previewPropertyImport(
  _prevState: ImportPreviewState,
  formData: FormData,
): Promise<ImportPreviewState> {
  // RBAC gate (FR-X-1) — fail closed BEFORE reading the upload (same permission as the
  // real import, so a user who cannot import cannot preview either).
  try {
    await requireStaffPermission('property.import');
  } catch {
    return deny('You do not have permission to import listings.');
  }

  const upload = await readImportCsv(formData);
  if ('error' in upload) {
    return deny(upload.error);
  }

  // FR-X-3 — apply the admin's chosen mapping (preset or custom) before validation. Absent
  // / malformed mapping falls back to the header-as-is convention (see `readImportMapping`).
  const mapping = readImportMapping(formData);

  const parseResult = parsePropertyImportCsv(upload.text, mapping);
  if (parseResult.parseError !== undefined) {
    return deny(parseResult.parseError);
  }

  // Suggest a CRM preset from the RAW header row (recognised targets + ignored source
  // headers reconstruct the file's headers when no mapping was applied), so the form can
  // pre-select it. Returns null for a canonical CSV or an unknown export.
  const detectedPreset = detectCrmPreset([
    ...parseResult.recognisedColumns,
    ...parseResult.ignoredColumns,
  ]);

  // FR-X-2 / FR-X-4 — simulate the chosen mode with the SAME pure planner the real
  // import runs. Create-only needs no catalogue read; an upsert mode takes one
  // tenant-scoped READ of the existing property identities to match against. Still a
  // dry run: nothing is written and nothing is audited.
  const mode = readImportMode(formData);
  const matchField = importMatchField(mode);
  let plan: PlannedRow[];
  if (matchField === null) {
    plan = planImportRows(parseResult.valid, null, new Map());
  } else {
    let existingKeys: ExistingPropertyKey[];
    try {
      const tenantId = await getCurrentTenantId();
      existingKeys = await withTenant(getDb(), tenantId, async (rawTx) => {
        const tx = rawTx as unknown as {
          property: {
            findMany(args: {
              where?: Record<string, unknown>;
              select?: Record<string, unknown>;
            }): Promise<ExistingPropertyKey[]>;
          };
        };
        return tx.property.findMany({
          where: { deletedAt: null },
          select: { id: true, reference: true, externalId: true },
        });
      });
    } catch {
      return deny('The existing listings could not be read to preview the upsert. Try again.');
    }
    plan = planImportRows(parseResult.valid, matchField, buildMatchIndex(existingKeys, matchField));
  }
  const outcome: ImportPreviewOutcome = {
    wouldCreate: plan.filter((planned) => planned.action === 'create').length,
    wouldUpdate: plan.filter((planned) => planned.action === 'update').length,
    wouldSkip: plan.filter((planned) => planned.action === 'skip').length,
  };

  // FR-X-10 — surface the plan-quota outcome so the admin sees whether the upload
  // fits BEFORE committing. Only rows the run would CREATE as PUBLISHED consume the
  // ACTIVE cap (matching the real import's check — drafts are not active and upsert
  // updates are never net-new). A read only — no insert, no import_logs write, no
  // audit. Best-effort: a quota-read failure must not break the (read-only) dry run.
  const incoming = plan.filter(
    (planned) => planned.action === 'create' && planned.row.data.publicationStatus === 'published',
  ).length;
  let quota: ImportPreviewQuota | undefined;
  try {
    const usage = await readActiveListingUsage();
    const wouldExceed = usage.existingActive + incoming > usage.limit;
    quota = {
      limit: usage.limit,
      existingActive: usage.existingActive,
      incoming,
      wouldExceed,
      remainingAfterImport: wouldExceed
        ? 0
        : Math.max(0, usage.limit - usage.existingActive - incoming),
    };
  } catch {
    quota = undefined;
  }

  const preview: ImportPreview = {
    counts: {
      input: parseResult.recordsInput,
      valid: parseResult.valid.length,
      invalid: parseResult.errors.length,
    },
    sample: parseResult.valid.slice(0, PREVIEW_SAMPLE_LIMIT).map(toSampleRow),
    errors: parseResult.errors.map(formatRowError),
    recognisedColumns: parseResult.recognisedColumns,
    ignoredColumns: parseResult.ignoredColumns,
    detectedPreset,
    mode,
    outcome,
    ...(quota !== undefined ? { quota } : {}),
  };

  return { ok: true, preview };
}
