// responsive-coverage: opt-out all — asserts the page shell + the tenant-scoped
// read; layout is the admin-routes Playwright pass.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../lib/tenant.js', () => ({ getCurrentTenantId: async () => 'tenant-1' }));
vi.mock('../../../lib/db.js', () => ({ getDb: () => ({}) }));

const findMany = vi.fn();
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
    fn({ repairCategory: { findMany } }),
}));

vi.mock('./RepairCategoriesManager.js', () => ({
  RepairCategoriesManager: ({ categories }: { categories: Array<{ id: string }> }) => (
    <div data-testid="repair-categories-manager">{categories.length}</div>
  ),
}));

const { default: RepairCategoriesPage } = await import('./page.js');

describe('RepairCategoriesPage', () => {
  it('renders the heading + the manager with the tenant categories', async () => {
    findMany.mockResolvedValue([
      { id: 'c1', slug: 'plumbing', label: 'Plumbing', defaultUrgency: 'standard', visible: true },
    ]);
    render(await RepairCategoriesPage());

    expect(
      screen.getByRole('heading', { level: 1, name: 'Repair categories' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('repair-categories-manager')).toHaveTextContent('1');
    expect(findMany).toHaveBeenCalledWith({ orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }] });
  });
});
