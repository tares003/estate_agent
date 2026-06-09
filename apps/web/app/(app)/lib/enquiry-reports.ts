import { ENQUIRY_STATUSES, type EnquiryStatus } from '@estate/validators';

// EPIC-I CRM reporting (FR-I-10, master spec §I.5) — the enquiry pipeline report.
// Pure aggregation over a STRUCTURAL Prisma client (DB-free to unit-test, mirrors
// enquiries.ts); the live query runs tenant-scoped (RLS) via withTenant in the
// admin report page. No personal data leaves this module — counts only.

/** Date-range filter for any report (both bounds optional). */
export interface ReportDateRange {
  from?: Date;
  to?: Date;
}

/** Build the `createdAt` range `where` shared by every report query. */
export function buildReportWhere(range: ReportDateRange): Record<string, unknown> {
  const createdAt: { gte?: Date; lte?: Date } = {};
  if (range.from) createdAt.gte = range.from;
  if (range.to) createdAt.lte = range.to;
  return Object.keys(createdAt).length > 0 ? { createdAt } : {};
}

/** The statuses that mean an enquiry was contacted or progressed beyond it. */
const CONTACTED_STATUSES: readonly EnquiryStatus[] = [
  'contacted',
  'viewing_booked',
  'valuation_booked',
  'waiting',
  'converted',
  'lost',
];

/** The conversion funnel derived from a per-status count map. */
export interface PipelineSummary {
  total: number;
  contacted: number;
  converted: number;
  conversionRate: number;
}

/** The full pipeline report: the per-status breakdown plus the funnel summary. */
export interface EnquiryPipelineReport extends PipelineSummary {
  byStatus: Record<EnquiryStatus, number>;
}

/**
 * Derive the funnel from a per-status count map. `total` includes archived
 * (closed-out enquiries are kept for reporting, master spec §I.3); `contacted`
 * is the count that reached contact or beyond; `conversionRate` is guarded
 * against an empty pipeline.
 */
export function summarisePipeline(byStatus: Record<EnquiryStatus, number>): PipelineSummary {
  const total = ENQUIRY_STATUSES.reduce((sum, status) => sum + byStatus[status], 0);
  const contacted = CONTACTED_STATUSES.reduce((sum, status) => sum + byStatus[status], 0);
  const converted = byStatus.converted;
  return {
    total,
    contacted,
    converted,
    conversionRate: total === 0 ? 0 : converted / total,
  };
}

/** A Prisma `groupBy(['sourceUrl'])` row (`_count: { _all }`). */
export interface SourceGroupRow {
  sourceUrl: string | null;
  _count: { _all: number };
}

/** A normalised by-source count (a missing source is labelled `(direct)`). */
export interface EnquirySourceCount {
  source: string;
  count: number;
}

/** Normalise raw groupBy rows; a null source becomes the `(direct)` bucket. */
export function normaliseSourceCounts(rows: SourceGroupRow[]): EnquirySourceCount[] {
  return rows.map((row) => ({ source: row.sourceUrl ?? '(direct)', count: row._count._all }));
}

/** The structural client the reports need (a real PrismaClient satisfies it). */
export interface EnquiryReportReader {
  enquiry: {
    count(args: { where?: Record<string, unknown> }): Promise<number>;
    groupBy(args: {
      by: ['sourceUrl'];
      where?: Record<string, unknown>;
      _count: { _all: true };
      orderBy?: unknown;
    }): Promise<SourceGroupRow[]>;
  };
}

/** Build the enquiry pipeline report (per-status counts + the conversion funnel). */
export async function enquiryPipelineReport(
  db: EnquiryReportReader,
  range: ReportDateRange,
): Promise<EnquiryPipelineReport> {
  const where = buildReportWhere(range);
  const counts = await Promise.all(
    ENQUIRY_STATUSES.map((status) => db.enquiry.count({ where: { ...where, status } })),
  );
  const byStatus = Object.fromEntries(
    ENQUIRY_STATUSES.map((status, index) => [status, counts[index]]),
  ) as Record<EnquiryStatus, number>;
  return { byStatus, ...summarisePipeline(byStatus) };
}

/** The by-source breakdown, ordered most-first (master spec §I.5 "leads by source"). */
export async function enquiriesBySource(
  db: EnquiryReportReader,
  range: ReportDateRange,
): Promise<EnquirySourceCount[]> {
  const rows = await db.enquiry.groupBy({
    by: ['sourceUrl'],
    where: buildReportWhere(range),
    _count: { _all: true },
    orderBy: { _count: { sourceUrl: 'desc' } },
  });
  return normaliseSourceCounts(rows);
}
