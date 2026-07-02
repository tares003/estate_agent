'use server';

import { detectCrmPreset, type PresetName } from '@estate/validators';
import type { FormErrorItem } from '@estate/ui';

import { requireStaffPermission } from '../../../lib/staff-session.js';
import { readActiveListingUsage } from '../../../lib/import-quota.js';
import {
  formatRowError,
  parsePropertyImportCsv,
  type ImportColumn,
  type ValidRow,
} from './csv-import-core.js';
import { readImportCsv, readImportMapping } from './read-csv.js';

// EPIC-X FR-X-2 — the DRY-RUN preview of a bulk CSV property import.
//
// The admin uploads a CSV; this action parses + validates EVERY row with the SAME pure
// `csv-import-core` the real import uses, then returns the outcome so the admin can spot
// mapping / data problems BEFORE committing: total records detected, valid / invalid
// counts, a sample of the first ten records mapped to canonical property attributes,
// the per-row validation errors, and which columns were recognised vs ignored.
//
// A dry run creates NOTHING. It performs no tenant transaction, no property insert, no
// `import_logs` write and NO audit — reading + validating a file is not a state change,
// so the G4 audit rule does not apply here (the audited write happens later, when the
// admin confirms and `importPropertiesFromCsv` runs). RBAC is still fail-closed on the
// same `property.write` permission the real import gates on, so a user who could not
// import also cannot preview.

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
  /** The tenant's current active (published) listings. */
  existingActive: number;
  /** Valid rows this upload would create. */
  incoming: number;
  /** Whether committing this upload would push the tenant past the cap. */
  wouldExceed: boolean;
  /** Headroom left after a within-quota import (0 when at/over the cap). */
  remainingAfterImport: number;
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
  // RBAC gate — fail closed BEFORE reading the upload (same permission as the real
  // import, so a user who cannot import cannot preview either).
  try {
    await requireStaffPermission('property.write');
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

  // FR-X-10 — surface the plan-quota outcome so the admin sees whether the upload
  // fits BEFORE committing. Only the VALID rows would be created, so they are the
  // "incoming" count against the cap. A read only — no insert, no import_logs write,
  // no audit. Best-effort: a quota-read failure must not break the (read-only) dry run.
  const incoming = parseResult.valid.length;
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
    ...(quota !== undefined ? { quota } : {}),
  };

  return { ok: true, preview };
}
