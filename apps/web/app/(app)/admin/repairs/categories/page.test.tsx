// responsive-coverage: opt-out all — asserts the page shell + the tenant-scoped
// read; layout is the admin-routes Playwright pass.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../lib/tenant.js', () => ({ getCurrentTenantId: async () => 'tenant-1' }));
vi.mock('../../../lib/db.js', () => ({ getDb: () => ({}) }));

const requireStaffPermission = vi.fn();
vi.mock('../../../lib/staff-session.js', () => ({
  requireStaffPermission: (...args: unknown[]) => requireStaffPermission(...args),
}));

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

beforeEach(() => {
  vi.clearAllMocks();
  requireStaffPermission.mockResolvedValue(undefined);
  findMany.mockResolvedValue([
    { id: 'c1', slug: 'plumbing', label: 'Plumbing', defaultUrgency: 'standard', visible: true },
  ]);
});

describe('RepairCategoriesPage', () => {
  // Audit finding admin-read-surfaces-missing-rbac-gate: RBAC-gated fail-closed.
  it('gates on the repair_request.read permission before reading', async () => {
    render(await RepairCategoriesPage());
    expect(requireStaffPermission).toHaveBeenCalledWith('repair_request.read');
  });

  it('propagates a denial WITHOUT reading the catalogue (fail-closed)', async () => {
    requireStaffPermission.mockRejectedValueOnce(new Error('denied'));
    await expect(RepairCategoriesPage()).rejects.toThrow('denied');
    expect(findMany).not.toHaveBeenCalled();
  });

  it('renders the heading + the manager with the tenant categories', async () => {
    render(await RepairCategoriesPage());

    expect(
      screen.getByRole('heading', { level: 1, name: 'Repair categories' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('repair-categories-manager')).toHaveTextContent('1');
    expect(findMany).toHaveBeenCalledWith({ orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }] });
  });
});
