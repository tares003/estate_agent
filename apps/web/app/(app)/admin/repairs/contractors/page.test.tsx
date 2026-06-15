// responsive-coverage: opt-out all — asserts the page shell + the tenant-scoped read.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../lib/tenant.js', () => ({ getCurrentTenantId: async () => 'tenant-1' }));
vi.mock('../../../lib/db.js', () => ({ getDb: () => ({}) }));

const findMany = vi.fn();
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
    fn({ contractor: { findMany } }),
}));

vi.mock('./ContractorsManager.js', () => ({
  ContractorsManager: ({ contractors }: { contractors: Array<{ id: string }> }) => (
    <div data-testid="contractors-manager">{contractors.length}</div>
  ),
}));

const { default: ContractorsPage } = await import('./page.js');

describe('ContractorsPage', () => {
  it('renders the heading + the manager with the tenant contractors', async () => {
    findMany.mockResolvedValue([
      { id: 'k1', name: 'Ace', email: 'ace@example.com', phone: null, trade: null, active: true },
    ]);
    render(await ContractorsPage());

    expect(screen.getByRole('heading', { level: 1, name: 'Contractors' })).toBeInTheDocument();
    expect(screen.getByTestId('contractors-manager')).toHaveTextContent('1');
    expect(findMany).toHaveBeenCalledWith({ orderBy: { name: 'asc' } });
  });
});
