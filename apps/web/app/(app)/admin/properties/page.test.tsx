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
    fn({ property: { findMany, count } }),
}));

const { default: AdminPropertiesPage } = await import('./page.js');

const row = {
  id: 'p1',
  title: 'Edwardian semi',
  displayAddress: 'Palatine Road, Didsbury',
  saleType: 'sale',
  marketStatus: 'for_sale',
  price: 52_500_000,
  publishedAt: null,
};

function params(p: Record<string, string>) {
  return { searchParams: Promise.resolve(p) };
}

beforeEach(() => {
  vi.clearAllMocks();
  requireStaffPermission.mockResolvedValue(undefined);
  findMany.mockResolvedValue([row]);
  count.mockResolvedValue(1);
});

describe('AdminPropertiesPage', () => {
  // Audit finding admin-read-surfaces-missing-rbac-gate: the admin catalogue shows
  // unpublished drafts — RBAC-gated fail-closed.
  it('gates on the property.read permission before reading', async () => {
    render(await AdminPropertiesPage(params({})));
    expect(requireStaffPermission).toHaveBeenCalledWith('property.read');
  });

  it('propagates a denial WITHOUT reading the catalogue (fail-closed)', async () => {
    requireStaffPermission.mockRejectedValueOnce(new Error('denied'));
    await expect(AdminPropertiesPage(params({}))).rejects.toThrow('denied');
    expect(findMany).not.toHaveBeenCalled();
  });

  it('renders the heading + a draft listing from the tenant-scoped read (drafts included)', async () => {
    render(await AdminPropertiesPage(params({})));
    expect(screen.getByRole('heading', { level: 1, name: 'Properties' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New property' })).toHaveAttribute(
      'href',
      '/admin/properties/new',
    );
    const table = within(screen.getByRole('table'));
    expect(table.getByText('Palatine Road, Didsbury')).toBeInTheDocument();
    expect(table.getByText('Draft')).toBeInTheDocument();
    // admin query includes drafts (no publishedAt filter)
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { deletedAt: null } }));
  });

  it('applies the page param and renders with no params', async () => {
    await AdminPropertiesPage(params({ page: '2' }));
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 24 }));

    render(await AdminPropertiesPage({}));
    expect(screen.getByRole('heading', { level: 1, name: 'Properties' })).toBeInTheDocument();
  });
});
