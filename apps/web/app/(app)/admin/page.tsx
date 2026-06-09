import Link from 'next/link';
import { withTenant } from '@estate/db';

import { getDb } from '../lib/db.js';
import { enquiryPipelineReport, type EnquiryReportReader } from '../lib/enquiry-reports.js';
import { getCurrentTenantId } from '../lib/tenant.js';

// EPIC-H admin home (FR-H-1). The v1 dashboard: live at-a-glance KPIs (the enquiry
// conversion funnel, from the unit-tested pipeline read model, run tenant-scoped)
// plus quick access to the live admin surfaces. The full role-adaptive KPI grid +
// alerts + activity feed land as those capabilities do. Renders inside the shell's
// `main` landmark.

export const dynamic = 'force-dynamic';

const QUICK_LINKS = [
  { label: 'Enquiries', href: '/admin/enquiries', hint: 'The CRM lead queue' },
  { label: 'Contacts', href: '/admin/contacts', hint: 'Captured & converted contacts' },
  { label: 'Reports', href: '/admin/reports', hint: 'Conversion funnel & sources' },
  { label: 'Audit log', href: '/admin/audit', hint: 'Every state change' },
];

function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

export default async function AdminDashboardPage() {
  const tenantId = await getCurrentTenantId();
  const report = await withTenant(getDb(), tenantId, (tx) =>
    enquiryPipelineReport(tx as unknown as EnquiryReportReader, {}),
  );
  const kpis = [
    { label: 'Total enquiries', value: String(report.total) },
    { label: 'Converted', value: String(report.converted) },
    { label: 'Conversion rate', value: formatRate(report.conversionRate) },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="t-display-sm">Dashboard</h1>
        <p className="t-body-md text-text-secondary max-w-[60ch]">
          Welcome back. Jump into the day&rsquo;s work below.
        </p>
      </div>

      <section aria-labelledby="kpi-heading" className="flex flex-col gap-3">
        <h2 id="kpi-heading" className="t-heading-sm">
          At a glance
        </h2>
        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-3">
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

      <section aria-labelledby="quick-heading" className="flex flex-col gap-3">
        <h2 id="quick-heading" className="t-heading-sm">
          Quick access
        </h2>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="border-divider bg-surface-raised hover:border-brand-primary flex flex-col gap-1 rounded-lg border p-6"
              >
                <span className="t-heading-sm text-brand-primary font-semibold">{link.label}</span>
                <span className="t-body-sm text-text-secondary">{link.hint}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
