// responsive-coverage: opt-out all — asserts the page shell, the RBAC gate and the
// tenant-clock formatting; layout is the admin-routes Playwright pass.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// EPIC-U FR-U-7 / FR-U-9 + master spec §H.23 — the scheduled-tasks console page. Pins the
// fail-closed RBAC gate, and that every timestamp is rendered on the TENANT's clock (a
// London agency must not be told their 07:00 digest runs at 06:00).

const getTenantTimezone = vi.fn();
vi.mock('../../lib/tenant.js', () => ({
  getCurrentTenantId: async () => 'tenant-1',
  getTenantTimezone: (...args: unknown[]) => getTenantTimezone(...args),
}));
vi.mock('../../lib/db.js', () => ({ getDb: () => ({}) }));

const requireStaffPermission = vi.fn();
vi.mock('../../lib/staff-session.js', () => ({
  requireStaffPermission: (...args: unknown[]) => requireStaffPermission(...args),
}));

const loadScheduledTasks = vi.fn();
vi.mock('../../lib/scheduled-tasks.js', () => ({
  loadScheduledTasks: (...args: unknown[]) => loadScheduledTasks(...args),
}));

vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) => fn({}),
}));

interface StubTask {
  id: string;
  lastRun: string;
  nextRun: string;
  controllable: boolean;
}
vi.mock('./ScheduledTasksTable.js', () => ({
  ScheduledTasksTable: ({ tasks }: { tasks: StubTask[] }) => (
    <div data-testid="scheduled-tasks-table">
      {tasks.map((task) => (
        <div key={task.id} data-testid={`task-${task.id}`}>
          <span data-testid={`last-${task.id}`}>{task.lastRun}</span>
          <span data-testid={`next-${task.id}`}>{task.nextRun}</span>
          <span data-testid={`controllable-${task.id}`}>{String(task.controllable)}</span>
        </div>
      ))}
    </div>
  ),
}));

const { default: ScheduledTasksPage } = await import('./page.js');

/** A daily digest that last ran at 07:00 London (06:00Z, BST) and runs next the same hour. */
function dailyRow() {
  return {
    worker: {
      id: 'saved_search_daily',
      name: 'Saved-search alerts (daily)',
      description: 'd',
      cadence: 'daily' as const,
      schedule: '07:00 tenant-local',
      localHour: 7,
      perTenant: true,
    },
    lastRunAt: new Date('2026-07-01T06:00:00Z'),
    lastOutcome: 'success' as const,
    lastDetail: 'emailed 3',
    averageRuntimeMs: 1400,
    runCount: 2,
    nextRunAt: new Date('2026-07-02T06:00:00Z'),
    paused: false,
    runRequested: false,
  };
}

/** A continuous outbox dispatcher — listed, but not controllable per tenant. */
function dispatcherRow() {
  return {
    worker: {
      id: 'email_send',
      name: 'Email dispatch',
      description: 'e',
      cadence: 'interval' as const,
      schedule: 'every 30 seconds',
      perTenant: false,
    },
    lastRunAt: null,
    lastOutcome: null,
    lastDetail: null,
    averageRuntimeMs: null,
    runCount: 0,
    nextRunAt: null,
    paused: false,
    runRequested: false,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  requireStaffPermission.mockResolvedValue(undefined);
  getTenantTimezone.mockResolvedValue('Europe/London');
  loadScheduledTasks.mockResolvedValue([dailyRow(), dispatcherRow()]);
});

describe('ScheduledTasksPage', () => {
  it('gates on the setting.manage permission before reading anything (fail-closed)', async () => {
    render(await ScheduledTasksPage());
    expect(requireStaffPermission).toHaveBeenCalledWith('setting.manage');
  });

  it('propagates a denial WITHOUT reading the run log', async () => {
    requireStaffPermission.mockRejectedValueOnce(new Error('denied'));
    await expect(ScheduledTasksPage()).rejects.toThrow('denied');
    expect(loadScheduledTasks).not.toHaveBeenCalled();
  });

  it('renders the heading and the console table', async () => {
    render(await ScheduledTasksPage());

    expect(screen.getByRole('heading', { level: 1, name: 'Scheduled tasks' })).toBeInTheDocument();
    expect(screen.getByTestId('scheduled-tasks-table')).toBeInTheDocument();
  });

  it('formats every timestamp on the TENANT clock, not the server clock (FR-U-9)', async () => {
    render(await ScheduledTasksPage());

    // 06:00Z is 07:00 in London (BST) — the console must say 07:00, the hour the tenant
    // actually receives the digest.
    expect(screen.getByTestId('last-saved_search_daily')).toHaveTextContent('07:00');
    expect(screen.getByTestId('next-saved_search_daily')).toHaveTextContent('07:00');
    expect(loadScheduledTasks).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ timeZone: 'Europe/London' }),
    );
  });

  it('marks a continuous dispatcher as such instead of offering controls that do nothing', async () => {
    render(await ScheduledTasksPage());

    expect(screen.getByTestId('controllable-email_send')).toHaveTextContent('false');
    expect(screen.getByTestId('next-email_send')).toHaveTextContent('Continuous');
    expect(screen.getByTestId('controllable-saved_search_daily')).toHaveTextContent('true');
  });
});
