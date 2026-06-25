// responsive-coverage: opt-out all — asserts the report composition + the
// tenant-scoped queries + the date-range wiring; layout is the admin-routes
// Playwright pass (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

vi.mock('../../lib/tenant.js', () => ({ getCurrentTenantId: async () => 'tenant-1' }));
vi.mock('../../lib/db.js', () => ({ getDb: () => ({}) }));

const count = vi.fn();
const groupBy = vi.fn();
const findMany = vi.fn();
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
    fn({ enquiry: { count, groupBy }, feedback: { findMany } }),
}));

const { default: ReportsPage } = await import('./page.js');

function params(p: Record<string, string>) {
  return { searchParams: Promise.resolve(p) };
}

beforeEach(() => {
  vi.clearAllMocks();
  // every status count → returns the status-keyed value via the where filter
  count.mockImplementation(async (args: { where?: { status?: string } }) => {
    const status = args.where?.status;
    return status === 'new' ? 5 : status === 'converted' ? 5 : 0;
  });
  groupBy.mockResolvedValue([{ sourceUrl: '/buy', _count: { _all: 10 } }]);
  findMany.mockResolvedValue([{ agentActor: 'Avery Adams', rating: 5 }]);
});

describe('ReportsPage', () => {
  it('renders the funnel KPIs + by-source from the tenant-scoped reports', async () => {
    render(await ReportsPage(params({})));

    expect(screen.getByRole('heading', { level: 1, name: 'Reports' })).toBeInTheDocument();
    const funnel = within(screen.getByRole('region', { name: 'Conversion funnel' }));
    expect(funnel.getByText('10')).toBeInTheDocument(); // total = 5 new + 5 converted
    expect(funnel.getByText('50.0%')).toBeInTheDocument(); // 5 converted / 10 total
    expect(
      within(screen.getByRole('region', { name: 'By source' })).getByText('/buy'),
    ).toBeInTheDocument();
  });

  it('renders the per-agent rating rollup from the tenant-scoped feedback', async () => {
    render(await ReportsPage(params({})));

    const agents = within(screen.getByRole('region', { name: 'Agent ratings' }));
    expect(agents.getByText('Avery Adams')).toBeInTheDocument();
    expect(agents.getByText('5 / 5')).toBeInTheDocument();
  });

  it('passes the parsed date range into the queries and reflects it in the filter', async () => {
    count.mockResolvedValue(0);
    groupBy.mockResolvedValue([]);

    render(await ReportsPage(params({ from: '2026-01-01', to: '2026-02-01' })));

    // the createdAt range reaches the count query
    expect(count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { gte: new Date('2026-01-01'), lte: new Date('2026-02-01') },
        }),
      }),
    );
    expect(screen.getByLabelText('From')).toHaveValue('2026-01-01');
  });

  it('renders with no search params (the bare /admin/reports entry)', async () => {
    count.mockResolvedValue(0);
    groupBy.mockResolvedValue([]);
    render(await ReportsPage({}));
    expect(screen.getByRole('heading', { level: 1, name: 'Reports' })).toBeInTheDocument();
  });
});
