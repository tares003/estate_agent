import Link from 'next/link';

// EPIC-H admin home (FR-H-1). The role-adaptive KPI dashboard is the full
// deliverable; this is the v1 landing — a heading and quick access to the live
// admin surfaces. It grows into the KPI/alerts/activity layout as those land.
// Token-driven (G7); renders inside the shell's `main` landmark.

const QUICK_LINKS = [{ label: 'Enquiries', href: '/admin/enquiries', hint: 'The CRM lead queue' }];

export default function AdminDashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="t-display-sm">Dashboard</h1>
        <p className="t-body-md text-text-secondary max-w-[60ch]">
          Welcome back. Jump into the day&rsquo;s work below.
        </p>
      </div>

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
    </div>
  );
}
