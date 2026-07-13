// responsive-coverage: opt-out all — asserts the data→table composition + the
// tenant-scoped query; responsive layout is the admin-routes Playwright pass.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

vi.mock('../../lib/tenant.js', () => ({ getCurrentTenantId: async () => 'tenant-1' }));
vi.mock('../../lib/db.js', () => ({ getDb: () => ({}) }));

const requireStaffPermission = vi.fn();
vi.mock('../../lib/staff-session.js', () => ({
  requireStaffPermission: (...args: unknown[]) => requireStaffPermission(...args),
}));

const findMany = vi.fn();
const count = vi.fn();
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
    fn({ user: { findMany, count } }),
}));

const { default: UsersPage } = await import('./page.js');

const row = { id: 'u1', name: 'Ana Agent', email: 'ana@agency.test', role: 'branch_manager' };

function params(p: Record<string, string>) {
  return { searchParams: Promise.resolve(p) };
}

beforeEach(() => {
  vi.clearAllMocks();
  requireStaffPermission.mockResolvedValue(undefined);
  findMany.mockResolvedValue([row]);
  count.mockResolvedValue(1);
});

describe('UsersPage', () => {
  // Audit finding admin-read-pages-ungated-pii-leak: the staff directory must be
  // RBAC-gated fail-closed, mirroring feedback/page.tsx.
  it('gates on the user.read permission before reading', async () => {
    render(await UsersPage(params({})));
    expect(requireStaffPermission).toHaveBeenCalledWith('user.read');
  });

  it('propagates a denial WITHOUT reading the directory (fail-closed)', async () => {
    requireStaffPermission.mockRejectedValueOnce(new Error('denied'));
    await expect(UsersPage(params({}))).rejects.toThrow('denied');
    expect(findMany).not.toHaveBeenCalled();
  });

  it('renders the Team heading + a staff row from the tenant-scoped read', async () => {
    render(await UsersPage(params({})));
    expect(screen.getByRole('heading', { level: 1, name: 'Team' })).toBeInTheDocument();
    const table = within(screen.getByRole('table'));
    expect(table.getByText('Ana Agent')).toBeInTheDocument();
    expect(table.getByText('Branch manager')).toBeInTheDocument();
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { name: 'asc' } }));
  });

  it('applies the page param and renders with no params', async () => {
    await UsersPage(params({ page: '2' }));
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 24 }));

    render(await UsersPage({}));
    expect(screen.getByRole('heading', { level: 1, name: 'Team' })).toBeInTheDocument();
  });
});
