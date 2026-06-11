// responsive-coverage: opt-out all — asserts the page shell + the tenant-scoped
// read; layout is the admin-routes Playwright pass.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../lib/tenant.js', () => ({ getCurrentTenantId: async () => 'tenant-1' }));
vi.mock('../../lib/db.js', () => ({ getDb: () => ({}) }));

const findMany = vi.fn();
const count = vi.fn();
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
    fn({ repairRequest: { findMany, count } }),
}));

// The table is presentational; stub it so the page test focuses on the read + shell.
vi.mock('./RepairsInboxTable.js', () => ({
  RepairsInboxTable: ({
    result,
    options,
  }: {
    result: { items: Array<{ id: string }>; total: number };
    options: { urgency?: string };
  }) => (
    <div data-testid="repairs-inbox-table">
      {`${result.items.length}/${result.total}:${options.urgency ?? 'all'}`}
    </div>
  ),
}));

const { default: RepairsInboxPage } = await import('./page.js');

beforeEach(() => {
  vi.clearAllMocks();
  findMany.mockResolvedValue([
    {
      id: 'r1',
      name: 'Tess',
      reference: null,
      category: 'Plumbing',
      urgency: 'urgent',
      status: 'new',
      createdAt: new Date(),
    },
  ]);
  count.mockResolvedValue(1);
});

describe('RepairsInboxPage', () => {
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
});
