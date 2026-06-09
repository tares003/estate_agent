// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import {
  buildReportWhere,
  enquiriesBySource,
  enquiryPipelineReport,
  normaliseSourceCounts,
  summarisePipeline,
  type EnquiryReportReader,
  type SourceGroupRow,
} from './enquiry-reports.js';

// EPIC-I CRM (FR-I-10, master spec §I.5): the enquiry pipeline report — the
// conversion funnel (new → contacted → converted) and the by-source breakdown.
// DB-free over a structural client; the live query runs tenant-scoped via withTenant.

const FROM = new Date('2026-01-01T00:00:00.000Z');
const TO = new Date('2026-02-01T00:00:00.000Z');

describe('buildReportWhere', () => {
  it('is empty when no date range is given', () => {
    expect(buildReportWhere({})).toEqual({});
  });

  it('builds a createdAt range from from/to', () => {
    expect(buildReportWhere({ from: FROM })).toEqual({ createdAt: { gte: FROM } });
    expect(buildReportWhere({ from: FROM, to: TO })).toEqual({ createdAt: { gte: FROM, lte: TO } });
    expect(buildReportWhere({ to: TO })).toEqual({ createdAt: { lte: TO } });
  });
});

describe('summarisePipeline', () => {
  it('counts the funnel and computes the conversion rate', () => {
    const summary = summarisePipeline({
      new: 10,
      contacted: 6,
      viewing_booked: 2,
      valuation_booked: 1,
      waiting: 1,
      converted: 4,
      lost: 3,
      archived: 5,
    });
    // total = every status incl. archived (closed-out leads are kept for reporting)
    expect(summary.total).toBe(32);
    // contacted = reached contact or beyond (excludes new + archived)
    expect(summary.contacted).toBe(17);
    expect(summary.converted).toBe(4);
    expect(summary.conversionRate).toBeCloseTo(4 / 32);
  });

  it('reports a zero conversion rate with no enquiries (no divide-by-zero)', () => {
    const summary = summarisePipeline({
      new: 0,
      contacted: 0,
      viewing_booked: 0,
      valuation_booked: 0,
      waiting: 0,
      converted: 0,
      lost: 0,
      archived: 0,
    });
    expect(summary.total).toBe(0);
    expect(summary.conversionRate).toBe(0);
  });
});

describe('normaliseSourceCounts', () => {
  it('maps groupBy rows and labels a missing source as direct', () => {
    const rows: SourceGroupRow[] = [
      { sourceUrl: '/buy', _count: { _all: 7 } },
      { sourceUrl: null, _count: { _all: 3 } },
    ];
    expect(normaliseSourceCounts(rows)).toEqual([
      { source: '/buy', count: 7 },
      { source: '(direct)', count: 3 },
    ]);
  });
});

function reader(over: { countByStatus?: Record<string, number>; groupRows?: SourceGroupRow[] }): {
  db: EnquiryReportReader;
  calls: { count: unknown[]; groupBy: unknown[] };
} {
  const calls = { count: [] as unknown[], groupBy: [] as unknown[] };
  const db: EnquiryReportReader = {
    enquiry: {
      count: vi.fn(async (args: { where?: Record<string, unknown> }) => {
        calls.count.push(args);
        const status = (args.where as { status?: string } | undefined)?.status;
        return over.countByStatus?.[status ?? ''] ?? 0;
      }),
      groupBy: vi.fn(async (args) => {
        calls.groupBy.push(args);
        return over.groupRows ?? [];
      }),
    },
  };
  return { db, calls };
}

describe('enquiryPipelineReport', () => {
  it('counts every status (date-filtered) and derives the funnel', async () => {
    const { db, calls } = reader({ countByStatus: { new: 5, contacted: 2, converted: 3 } });
    const report = await enquiryPipelineReport(db, { from: FROM });

    expect(report.byStatus.new).toBe(5);
    expect(report.byStatus.converted).toBe(3);
    expect(report.byStatus.archived).toBe(0);
    expect(report.total).toBe(10);
    expect(report.converted).toBe(3);
    // every count is scoped to the date range
    expect((calls.count[0] as { where: { createdAt?: unknown } }).where.createdAt).toEqual({
      gte: FROM,
    });
  });
});

describe('enquiriesBySource', () => {
  it('groups by source, scoped to the date range, ordered by count', async () => {
    const { db, calls } = reader({ groupRows: [{ sourceUrl: '/buy', _count: { _all: 7 } }] });
    const result = await enquiriesBySource(db, { from: FROM, to: TO });

    expect(result).toEqual([{ source: '/buy', count: 7 }]);
    expect(calls.groupBy[0]).toMatchObject({
      by: ['sourceUrl'],
      where: { createdAt: { gte: FROM, lte: TO } },
    });
  });
});
