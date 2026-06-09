import { withTenant } from '@estate/db';

import { getDb } from '../../lib/db.js';
import {
  enquiriesBySource,
  enquiryPipelineReport,
  type EnquiryReportReader,
} from '../../lib/enquiry-reports.js';
import { getCurrentTenantId } from '../../lib/tenant.js';
import { PipelineReport } from './PipelineReport.js';
import { parseReportRange, toDateInputValue } from './reports-params.js';

// EPIC-H reports (FR-H-18) — the enquiry pipeline report at /admin/reports. URL-
// driven date range; resolves the tenant, runs the (unit-tested) read model inside
// the tenant RLS scope, and renders the funnel + by-source breakdown. Thin
// composition; renders inside the admin shell's `main` landmark. The full report
// suite + custom builder + export (FR-H-18) are deferred.

export const dynamic = 'force-dynamic';

interface ReportsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const range = parseReportRange((await searchParams) ?? {});
  const tenantId = await getCurrentTenantId();
  const { report, sources } = await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as EnquiryReportReader;
    const [pipelineReport, sourceCounts] = await Promise.all([
      enquiryPipelineReport(tx, range),
      enquiriesBySource(tx, range),
    ]);
    return { report: pipelineReport, sources: sourceCounts };
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="t-display-sm">Reports</h1>

      <form method="get" className="flex flex-wrap items-end gap-4" aria-label="Report date range">
        <label className="flex flex-col gap-1">
          <span className="t-body-sm text-text-secondary">From</span>
          <input
            type="date"
            name="from"
            defaultValue={toDateInputValue(range.from)}
            className="border-divider rounded-md border px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="t-body-sm text-text-secondary">To</span>
          <input
            type="date"
            name="to"
            defaultValue={toDateInputValue(range.to)}
            className="border-divider rounded-md border px-3 py-2"
          />
        </label>
        <button
          type="submit"
          className="t-body-md text-brand-primary border-brand-primary rounded-md border px-4 py-2"
        >
          Apply
        </button>
      </form>

      <PipelineReport report={report} sources={sources} />
    </div>
  );
}
