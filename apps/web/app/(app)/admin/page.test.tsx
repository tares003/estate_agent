// responsive-coverage: opt-out all — asserts the dashboard KPIs + quick links from
// the tenant-scoped read; the responsive card grid is the admin-routes Playwright
// pass (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

vi.mock('../lib/tenant.js', () => ({ getCurrentTenantId: async () => 'tenant-1' }));
vi.mock('../lib/db.js', () => ({ getDb: () => ({}) }));

const count = vi.fn();
const feedbackCount = vi.fn();
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
    fn({ enquiry: { count }, feedback: { count: feedbackCount } }),
}));

const { default: AdminDashboardPage } = await import('./page.js');

beforeEach(() => {
  vi.clearAllMocks();
  // 5 new + 5 converted → total 10, conversion rate 50%
  count.mockImplementation(async (args: { where?: { status?: string } }) => {
    const status = args.where?.status;
    return status === 'new' ? 5 : status === 'converted' ? 5 : 0;
  });
  // 3 feedback rows flagged needsResponse (FR-AC-10)
  feedbackCount.mockResolvedValue(3);
});

describe('AdminDashboardPage', () => {
  it('renders live KPIs from the tenant-scoped pipeline report', async () => {
    render(await AdminDashboardPage());
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    const kpis = within(screen.getByRole('region', { name: 'At a glance' }));
    expect(kpis.getByText('Total enquiries')).toBeInTheDocument();
    expect(kpis.getByText('10')).toBeInTheDocument();
    expect(kpis.getByText('50.0%')).toBeInTheDocument();
  });

  it('surfaces the needs-response feedback KPI linking to the moderation queue (FR-AC-10)', async () => {
    render(await AdminDashboardPage());
    const kpis = within(screen.getByRole('region', { name: 'At a glance' }));
    expect(kpis.getByText('Feedback needs response')).toBeInTheDocument();
    expect(kpis.getByText('3')).toBeInTheDocument();
    expect(kpis.getByRole('link', { name: /Feedback needs response/ })).toHaveAttribute(
      'href',
      '/admin/feedback',
    );
  });

  it('offers quick access to the live admin surfaces', async () => {
    render(await AdminDashboardPage());
    const quick = within(screen.getByRole('region', { name: 'Quick access' }));
    expect(quick.getByRole('link', { name: /Enquiries/ })).toHaveAttribute(
      'href',
      '/admin/enquiries',
    );
    expect(quick.getByRole('link', { name: /Audit log/ })).toHaveAttribute('href', '/admin/audit');
  });
});
