import { parse } from 'csv-parse/sync';
import { propertyCreateSchema, type PropertyCreate } from '@estate/validators';

// EPIC-X FR-X-1 / FR-X-6 — the PURE, DB-free core of the bulk CSV property import.
// Parses a CSV string, maps each column to a property-create field BY HEADER NAME
// (the header must equal the schema field name — the documented V1 convention; the
// arbitrary-header column-MAPPING UI in FR-X-3 is deferred), validates every row
// against `propertyCreateSchema`, and partitions the file into {valid rows,
// per-row errors}. No I/O, no session, no DB — the audited action layer feeds this a
// string and persists the result; this module is exhaustively unit-tested.
//
// V1 slice: this CREATES properties (FR-X-1). The dry-run preview (FR-X-2), preset CRM
// mappings (FR-X-3), upsert / external-id matching (FR-X-4/5), quota enforcement
// (FR-X-10) and image post-processing (FR-X-11) are later slices of this epic.

/**
 * The CSV column headers the importer understands. Each equals a `propertyCreateSchema`
 * field name (the documented V1 header convention). `reference`, `listingType`,
 * `saleType`, `displayAddress` and `postcode` are REQUIRED by the schema; the rest are
 * optional. Any column whose header is not in this set is ignored (surfaced as a run
 * note), so a raw CRM export with extra columns still imports its recognised fields.
 */
export const IMPORT_COLUMNS = [
  'reference',
  'listingType',
  'saleType',
  'slug',
  'title',
  'description',
  'price',
  'priceQualifier',
  'marketStatus',
  'bedrooms',
  'bathrooms',
  'category',
  'tenure',
  'councilTaxBand',
  'epcRating',
  'metaTitle',
  'metaDescription',
  'publicationStatus',
  'displayAddress',
  'postcode',
  'town',
] as const;

/** A recognised import column header. */
export type ImportColumn = (typeof IMPORT_COLUMNS)[number];

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

/** Shape a parsed CSV record (header -> cell) into the schema's typed input object. */
function toCandidate(record: Record<string, string>): Record<string, unknown> {
  const candidate: Record<string, unknown> = {};
  for (const [header, rawValue] of Object.entries(record)) {
    if (!IMPORT_COLUMN_SET.has(header)) continue;
    const coerced = coerceCell(header as ImportColumn, rawValue);
    if (coerced !== undefined) candidate[header] = coerced;
  }
  return candidate;
}

/**
 * Parse + validate a bulk-import CSV string (FR-X-1). Returns every DATA row
 * partitioned into {valid, errors}. A row that fails validation is isolated with its
 * per-field reasons and the run continues (FR-X-5). A malformed file (bad CSV, or no
 * data rows) returns a `parseError` and no rows — the caller reports it without a
 * partial import.
 */
export function parsePropertyImportCsv(csvText: string): CsvImportParse {
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

  const recognisedColumns = IMPORT_COLUMNS.filter((column) => headers.includes(column));
  const ignoredColumns = headers.filter((header) => !IMPORT_COLUMN_SET.has(header));

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
    const candidate = toCandidate(record);
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
