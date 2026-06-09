import type { ReportDateRange } from '../../lib/enquiry-reports.js';

// EPIC-H reports (FR-H-18) — the URL is the single source of truth for the report
// date range. Pure parse + format helpers (no DB, no React), unit-tested so the
// page stays a thin composition. Mirrors the queue's queue-params.ts.

type RawParams = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseDate(value: string | undefined): Date | undefined {
  if (value === undefined || value === '') return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Parse the URL search params into a report date range (invalid dates dropped). */
export function parseReportRange(params: RawParams): ReportDateRange {
  const range: ReportDateRange = {};
  const from = parseDate(single(params['from']));
  if (from) range.from = from;
  const to = parseDate(single(params['to']));
  if (to) range.to = to;
  return range;
}

/** Format a date for an `<input type="date">` value (`yyyy-mm-dd`, UTC). */
export function toDateInputValue(date: Date | undefined): string {
  return date ? (date.toISOString().split('T')[0] ?? '') : '';
}
