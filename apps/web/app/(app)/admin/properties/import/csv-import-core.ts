import { parse } from 'csv-parse/sync';
import {
  IMPORT_COLUMNS,
  propertyCreateSchema,
  type ColumnMapping,
  type ImportColumn,
  type PropertyCreate,
} from '@estate/validators';

// EPIC-X FR-X-1 / FR-X-6 / FR-X-3 — the PURE, DB-free core of the bulk CSV property
// import. Parses a CSV string, translates each source header onto a canonical
// property-create field (via an optional column MAPPING; falling back to the header AS-IS
// when no mapping entry applies — the documented V1 convention), validates every row
// against `propertyCreateSchema`, and partitions the file into {valid rows, per-row
// errors}. No I/O, no session, no DB — the audited action layer feeds this a string (and
// a mapping) and persists the result; this module is exhaustively unit-tested.
//
// V1 slice: this CREATES properties (FR-X-1) and now applies a configurable / preset
// column mapping (FR-X-3). The dry-run preview (FR-X-2), upsert / external-id matching
// (FR-X-4/5), quota enforcement (FR-X-10) and image post-processing (FR-X-11) are later
// slices of this epic.

/**
 * The canonical column set the importer understands, re-exported from `@estate/validators`
 * (the single source of truth shared with the mapping presets + schema). Each equals a
 * `propertyCreateSchema` field name. `reference`, `listingType`, `saleType`,
 * `displayAddress` and `postcode` are REQUIRED by the schema; the rest are optional. A
 * source header that neither has a mapping entry nor equals a canonical name is ignored
 * (surfaced as a run note), so a raw CRM export with extra columns still imports its
 * recognised fields.
 */
export { IMPORT_COLUMNS };
export type { ImportColumn };

/** The columns whose CSV string cell must be coerced to a number before validation. */
const NUMERIC_COLUMNS = new Set<ImportColumn>(['price', 'bedrooms', 'bathrooms']);

const IMPORT_COLUMN_SET = new Set<string>(IMPORT_COLUMNS);

/** A per-field validation failure for one source row. */
export interface RowFieldError {
  /** The property field the error is attached to (empty for a row-level error). */
  field: string;
  message: string;
}

/** A source row that failed validation, with its 1-based CSV data-row number. */
export interface RowError {
  /** 1-based index among the DATA rows (the header is not counted). */
  rowNumber: number;
  errors: RowFieldError[];
}

/** A validated row ready for insert, paired with its source row number. */
export interface ValidRow {
  rowNumber: number;
  data: PropertyCreate;
}

/** The outcome of parsing + validating a CSV upload. */
export interface CsvImportParse {
  /** Total DATA rows detected (excludes the header). */
  recordsInput: number;
  /** Rows that validated cleanly, in source order. */
  valid: ValidRow[];
  /** Rows that failed validation, in source order. */
  errors: RowError[];
  /** Recognised headers actually present in the file. */
  recognisedColumns: ImportColumn[];
  /** Headers present in the file that the importer does not recognise (ignored). */
  ignoredColumns: string[];
  /** A file-level parse failure (malformed CSV / empty file); no rows were processed. */
  parseError?: string;
}

/**
 * Coerce a raw CSV cell for a given column into the value `propertyCreateSchema`
 * expects. Empty cells become `undefined` (the field is treated as absent, so the
 * schema applies its optional/default handling). Numeric columns are converted to a
 * `Number` (an unparseable value passes through as-is so the schema reports the type
 * error against the field rather than the importer swallowing it).
 */
function coerceCell(column: ImportColumn, rawValue: string): unknown {
  const value = rawValue.trim();
  if (value === '') return undefined;
  if (NUMERIC_COLUMNS.has(column)) {
    const asNumber = Number(value);
    return Number.isNaN(asNumber) ? value : asNumber;
  }
  return value;
}

/**
 * Resolve a source CSV header to a canonical `ImportColumn`, or `undefined` when the
 * header maps to nothing the importer understands (FR-X-3). Precedence: an explicit
 * mapping entry wins; otherwise the header is used AS-IS if it already equals a canonical
 * field name (the V1 header convention); otherwise the column is unrecognised (ignored).
 */
function resolveColumn(header: string, mapping: ColumnMapping | undefined): ImportColumn | undefined {
  const mapped = mapping?.[header];
  if (mapped !== undefined) return mapped;
  return IMPORT_COLUMN_SET.has(header) ? (header as ImportColumn) : undefined;
}

/**
 * Shape a parsed CSV record (source-header -> cell) into the schema's typed input object,
 * applying the column mapping so each cell lands under its CANONICAL field name before
 * coercion + validation (FR-X-3).
 */
function toCandidate(
  record: Record<string, string>,
  mapping: ColumnMapping | undefined,
): Record<string, unknown> {
  const candidate: Record<string, unknown> = {};
  for (const [header, rawValue] of Object.entries(record)) {
    const canonical = resolveColumn(header, mapping);
    if (canonical === undefined) continue;
    const coerced = coerceCell(canonical, rawValue);
    if (coerced !== undefined) candidate[canonical] = coerced;
  }
  return candidate;
}

/**
 * Parse + validate a bulk-import CSV string (FR-X-1), applying an optional column
 * `mapping` that translates arbitrary source headers onto canonical fields BEFORE
 * per-row validation (FR-X-3). Without a mapping (or for any header the mapping omits)
 * the source header is used as-is, so a canonical-header CSV imports unchanged
 * (backward-compatible). Returns every DATA row partitioned into {valid, errors}. A row
 * that fails validation is isolated with its per-field reasons and the run continues
 * (FR-X-5). A malformed file (bad CSV, or no data rows) returns a `parseError` and no
 * rows — the caller reports it without a partial import.
 */
export function parsePropertyImportCsv(
  csvText: string,
  mapping?: ColumnMapping,
): CsvImportParse {
  let records: Record<string, string>[];
  let headers: string[] = [];
  try {
    records = parse(csvText, {
      columns: (header: string[]) => {
        headers = header.map((h) => h.trim());
        return headers;
      },
      skip_empty_lines: true,
      trim: true,
      bom: true,
    }) as Record<string, string>[];
  } catch (error) {
    return {
      recordsInput: 0,
      valid: [],
      errors: [],
      recognisedColumns: [],
      ignoredColumns: [],
      parseError: error instanceof Error ? error.message : 'The CSV could not be read.',
    };
  }

  // A header is RECOGNISED when it resolves to a canonical column (via the mapping or as
  // a canonical name), IGNORED otherwise. `recognisedColumns` lists the canonical targets
  // actually present, de-duplicated and in canonical order.
  const resolvedByHeader = new Map<string, ImportColumn | undefined>(
    headers.map((header) => [header, resolveColumn(header, mapping)]),
  );
  const presentTargets = new Set<ImportColumn>();
  for (const target of resolvedByHeader.values()) {
    if (target !== undefined) presentTargets.add(target);
  }
  const recognisedColumns = IMPORT_COLUMNS.filter((column) => presentTargets.has(column));
  const ignoredColumns = headers.filter((header) => resolvedByHeader.get(header) === undefined);

  if (records.length === 0) {
    return {
      recordsInput: 0,
      valid: [],
      errors: [],
      recognisedColumns,
      ignoredColumns,
      parseError: 'The file contains no data rows.',
    };
  }

  const valid: ValidRow[] = [];
  const errors: RowError[] = [];

  records.forEach((record, index) => {
    const rowNumber = index + 1;
    const candidate = toCandidate(record, mapping);
    const parsed = propertyCreateSchema.safeParse(candidate);
    if (parsed.success) {
      valid.push({ rowNumber, data: parsed.data });
    } else {
      errors.push({
        rowNumber,
        errors: parsed.error.issues.map((issue) => ({
          field: typeof issue.path[0] === 'string' ? issue.path[0] : '',
          message: issue.message,
        })),
      });
    }
  });

  return { recordsInput: records.length, valid, errors, recognisedColumns, ignoredColumns };
}

/** Render one row's field errors as a single human-readable line for the error summary. */
export function formatRowError(rowError: RowError): string {
  const reasons = rowError.errors
    .map((error) => (error.field ? `${error.field}: ${error.message}` : error.message))
    .join('; ');
  return `Row ${rowError.rowNumber} — ${reasons}`;
}
