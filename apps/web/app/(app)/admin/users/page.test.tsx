// responsive-coverage: opt-out all — asserts the data→table composition + the
// tenant-scoped query; responsive layout is the admin-routes Playwright pass.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

vi.mock('../../lib/tenant.js', () => ({ getCurrentTenantId: async () => 'tenant-1' }));
vi.mock('../../lib/db.js', () => ({ getDb: () => ({}) }));

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
  findMany.mockResolvedValue([row]);
  count.mockResolvedValue(1);
});

describe('UsersPage', () => {
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
