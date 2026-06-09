import type { EnquiryPipelineReport, EnquirySourceCount } from '../../lib/enquiry-reports.js';

// EPIC-H reports (FR-H-18) — the enquiry pipeline report view. Presentational +
// pure; token-driven (G7). KPI tiles summarise the conversion funnel; the by-source
// table is the channel breakdown. The numbers come from the unit-tested read model.

function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

interface Kpi {
  label: string;
  value: string;
}

export function PipelineReport({
  report,
  sources,
}: {
  report: EnquiryPipelineReport;
  sources: EnquirySourceCount[];
}) {
  const kpis: Kpi[] = [
    { label: 'Total enquiries', value: String(report.total) },
    { label: 'Contacted', value: String(report.contacted) },
    { label: 'Converted', value: String(report.converted) },
    { label: 'Conversion rate', value: formatRate(report.conversionRate) },
  ];

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="funnel-heading" className="flex flex-col gap-3">
        <h2 id="funnel-heading" className="t-heading-sm">
          Conversion funnel
        </h2>
        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className="border-divider bg-surface-raised flex flex-col gap-1 rounded-lg border p-6"
            >
              <dt className="t-body-sm text-text-secondary">{kpi.label}</dt>
              <dd className="t-display-sm text-brand-primary">{kpi.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="source-heading" className="flex flex-col gap-3">
        <h2 id="source-heading" className="t-heading-sm">
          By source
        </h2>
        {sources.length === 0 ? (
          <p className="t-body-sm text-text-secondary">No enquiries in this period.</p>
        ) : (
          <table className="w-full max-w-[40ch] border-collapse text-left">
            <thead>
              <tr className="border-divider border-b">
                <th scope="col" className="t-body-sm text-text-secondary py-2 pr-4 font-semibold">
                  Source
                </th>
                <th scope="col" className="t-body-sm text-text-secondary py-2 font-semibold">
                  Enquiries
                </th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source) => (
                <tr key={source.source} className="border-divider border-b">
                  <td className="t-body-md py-2 pr-4">{source.source}</td>
                  <td className="t-body-md py-2">{source.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
