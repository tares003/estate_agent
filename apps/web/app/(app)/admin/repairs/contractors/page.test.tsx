// responsive-coverage: opt-out all — asserts the page shell + the tenant-scoped read.
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
    fn({ contractor: { findMany } }),
}));

vi.mock('./ContractorsManager.js', () => ({
  ContractorsManager: ({ contractors }: { contractors: Array<{ id: string }> }) => (
    <div data-testid="contractors-manager">{contractors.length}</div>
  ),
}));

const { default: ContractorsPage } = await import('./page.js');

beforeEach(() => {
  vi.clearAllMocks();
  requireStaffPermission.mockResolvedValue(undefined);
  findMany.mockResolvedValue([
    { id: 'k1', name: 'Ace', email: 'ace@example.com', phone: null, trade: null, active: true },
  ]);
});

describe('ContractorsPage', () => {
  // Audit finding admin-read-surfaces-missing-rbac-gate: the contractor directory
  // holds contact details — RBAC-gated fail-closed.
  it('gates on the repair_request.read permission before reading', async () => {
    render(await ContractorsPage());
    expect(requireStaffPermission).toHaveBeenCalledWith('repair_request.read');
  });

  it('propagates a denial WITHOUT reading the directory (fail-closed)', async () => {
    requireStaffPermission.mockRejectedValueOnce(new Error('denied'));
    await expect(ContractorsPage()).rejects.toThrow('denied');
    expect(findMany).not.toHaveBeenCalled();
  });

  it('renders the heading + the manager with the tenant contractors', async () => {
    render(await ContractorsPage());

    expect(screen.getByRole('heading', { level: 1, name: 'Contractors' })).toBeInTheDocument();
    expect(screen.getByTestId('contractors-manager')).toHaveTextContent('1');
    expect(findMany).toHaveBeenCalledWith({ orderBy: { name: 'asc' } });
  });
});
