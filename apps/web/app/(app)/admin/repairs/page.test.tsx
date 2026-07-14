// responsive-coverage: opt-out all — asserts the page shell + the tenant-scoped
// read; layout is the admin-routes Playwright pass.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../lib/tenant.js', () => ({ getCurrentTenantId: async () => 'tenant-1' }));
vi.mock('../../lib/db.js', () => ({ getDb: () => ({}) }));

const requireStaffPermission = vi.fn();
vi.mock('../../lib/staff-session.js', () => ({
  requireStaffPermission: (...args: unknown[]) => requireStaffPermission(...args),
}));

const findMany = vi.fn();
const count = vi.fn();
// FR-G-5/FR-G-9: the tenant's SLA config is read in the SAME tenant scope as the tickets.
const slaConfigFindFirst = vi.fn();
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
    fn({
      repairRequest: { findMany, count },
      repairSlaConfig: { findFirst: slaConfigFindFirst },
    }),
}));

// The table is presentational; stub it so the page test focuses on the read + shell.
vi.mock('./RepairsInboxTable.js', () => ({
  RepairsInboxTable: ({
    result,
    options,
  }: {
    result: { items: Array<{ id: string; slaRisk: string | null }>; total: number };
    options: { urgency?: string };
  }) => (
    <div data-testid="repairs-inbox-table" data-sla-risk={result.items[0]?.slaRisk ?? ''}>
      {`${result.items.length}/${result.total}:${options.urgency ?? 'all'}`}
    </div>
  ),
}));

const { default: RepairsInboxPage } = await import('./page.js');

/** A ticket submitted `hoursAgo` hours ago — so its SLA band is deterministic. */
function ticket(hoursAgo: number) {
  return {
    id: 'r1',
    name: 'Tess',
    reference: null,
    category: 'Plumbing',
    urgency: 'urgent',
    status: 'new',
    createdAt: new Date(Date.now() - hoursAgo * 3_600_000),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  requireStaffPermission.mockResolvedValue(undefined);
  findMany.mockResolvedValue([ticket(0)]);
  count.mockResolvedValue(1);
  // Unconfigured by default — the §G.4 / FR-G-9 defaults apply.
  slaConfigFindFirst.mockResolvedValue(null);
});

describe('RepairsInboxPage', () => {
  // Audit finding admin-read-surfaces-missing-rbac-gate: the repairs inbox holds
  // reporter PII — RBAC-gated fail-closed, mirroring feedback/page.tsx.
  it('gates on the repair_request.read permission before reading', async () => {
    render(await RepairsInboxPage({}));
    expect(requireStaffPermission).toHaveBeenCalledWith('repair_request.read');
  });

  it('propagates a denial WITHOUT reading the inbox (fail-closed)', async () => {
    requireStaffPermission.mockRejectedValueOnce(new Error('denied'));
    await expect(RepairsInboxPage({})).rejects.toThrow('denied');
    expect(findMany).not.toHaveBeenCalled();
  });

  it('renders the heading + the tenant-scoped repairs with the parsed filters', async () => {
    render(
      await RepairsInboxPage({
        searchParams: Promise.resolve({ urgency: 'urgent' }),
      }),
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Repairs' })).toBeInTheDocument();
    expect(screen.getByTestId('repairs-inbox-table')).toHaveTextContent('1/1:urgent');
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { notIn: ['completed', 'rejected'] }, urgency: 'urgent' },
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('defaults to the open-tickets view when there are no params', async () => {
    render(await RepairsInboxPage({}));
    expect(screen.getByTestId('repairs-inbox-table')).toHaveTextContent('1/1:all');
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: { notIn: ['completed', 'rejected'] } } }),
    );
  });

  // FR-G-5 / FR-G-9 (audit finding repair-urgency-sla-not-configurable): the badges
  // band against the tenant's configured SLA, read in the SAME tenant scope.
  it('bands against the §G.4 defaults when the tenant has configured no SLA', async () => {
    // An urgent ticket 3h old is 12.5% of the default 24h target — on track.
    findMany.mockResolvedValue([ticket(3)]);

    render(await RepairsInboxPage({}));

    expect(slaConfigFindFirst).toHaveBeenCalled();
    expect(screen.getByTestId('repairs-inbox-table')).toHaveAttribute('data-sla-risk', 'on_track');
  });

  it('bands against the tenant-configured SLA when one exists', async () => {
    // The same 3h-old urgent ticket is 75% of a configured 4h target — due soon.
    findMany.mockResolvedValue([ticket(3)]);
    slaConfigFindFirst.mockResolvedValue({
      emergencyTargetHours: 4,
      urgentTargetHours: 4,
      standardTargetHours: 48,
      lowTargetWorkingDays: 5,
      dueSoonThresholdPercent: 50,
      atRiskThresholdPercent: 75,
    });

    render(await RepairsInboxPage({}));

    expect(screen.getByTestId('repairs-inbox-table')).toHaveAttribute('data-sla-risk', 'due_soon');
  });
});
