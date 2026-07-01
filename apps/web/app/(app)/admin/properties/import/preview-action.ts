'use server';

import type { FormErrorItem } from '@estate/ui';

import { requireStaffPermission } from '../../../lib/staff-session.js';
import {
  formatRowError,
  parsePropertyImportCsv,
  type ImportColumn,
  type ValidRow,
} from './csv-import-core.js';
import { readImportCsv } from './read-csv.js';

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

  const parseResult = parsePropertyImportCsv(upload.text);
  if (parseResult.parseError !== undefined) {
    return deny(parseResult.parseError);
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
  };

  return { ok: true, preview };
}
