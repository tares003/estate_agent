// responsive-coverage: opt-out all — asserts the data→table composition + the
// tenant-scoped query; responsive layout is the admin-routes Playwright pass.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../lib/tenant.js', () => ({ getCurrentTenantId: async () => 'tenant-1' }));
vi.mock('../../lib/db.js', () => ({ getDb: () => ({}) }));

const findMany = vi.fn();
const count = vi.fn();
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
    fn({ contact: { findMany, count } }),
}));

const { default: ContactsPage } = await import('./page.js');

const row = {
  id: 'c1',
  name: 'Sam Buyer',
  email: 'sam@example.com',
  phone: null,
  type: 'buyer',
  createdAt: new Date('2026-06-09T12:00:00.000Z'),
};

function params(p: Record<string, string>) {
  return { searchParams: Promise.resolve(p) };
}

beforeEach(() => {
  vi.clearAllMocks();
  findMany.mockResolvedValue([row]);
  count.mockResolvedValue(1);
});

describe('ContactsPage', () => {
  it('renders the directory heading + a row from the tenant-scoped read', async () => {
    render(await ContactsPage(params({})));
    expect(screen.getByRole('heading', { level: 1, name: 'Contacts' })).toBeInTheDocument();
    expect(screen.getByText('Sam Buyer')).toBeInTheDocument();
    // hides soft-deleted contacts by default
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { deletedAt: null } }));
  });

  it('passes the type filter through and renders with no params', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
    render(await ContactsPage(params({ type: 'vendor' })));
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null, type: 'vendor' } }),
    );

    render(await ContactsPage({}));
    expect(screen.getAllByRole('heading', { level: 1, name: 'Contacts' }).length).toBeGreaterThan(
      0,
    );
  });
});
