// responsive-coverage: opt-out all — asserts the page shell + the tenant-scoped
// read; layout is the admin-routes Playwright pass.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../lib/tenant.js', () => ({ getCurrentTenantId: async () => 'tenant-1' }));
vi.mock('../../lib/db.js', () => ({ getDb: () => ({}) }));

const findMany = vi.fn();
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
    fn({ repairRequest: { findMany } }),
}));

// The table is presentational; stub it so the page test focuses on the read + shell.
vi.mock('./RepairsInboxTable.js', () => ({
  RepairsInboxTable: ({ repairs }: { repairs: Array<{ id: string }> }) => (
    <div data-testid="repairs-inbox-table">{repairs.length}</div>
  ),
}));

const { default: RepairsInboxPage } = await import('./page.js');

describe('RepairsInboxPage', () => {
  it('renders the heading + the tenant-scoped repairs', async () => {
    findMany.mockResolvedValue([
      { id: 'r1', name: 'Tess', reference: null, category: 'Plumbing', urgency: 'urgent', status: 'new', createdAt: new Date() },
    ]);
    render(await RepairsInboxPage());

    expect(screen.getByRole('heading', { level: 1, name: 'Repairs' })).toBeInTheDocument();
    expect(screen.getByTestId('repairs-inbox-table')).toHaveTextContent('1');
    expect(findMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'desc' } });
  });
});
