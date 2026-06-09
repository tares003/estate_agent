// responsive-coverage: opt-out all — asserts the detail composition + the
// tenant-scoped read + the not-found path; layout is the admin-routes Playwright pass.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../lib/tenant.js', () => ({ getCurrentTenantId: async () => 'tenant-1' }));
vi.mock('../../../lib/db.js', () => ({ getDb: () => ({}) }));

const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', () => ({ notFound: () => notFound() }));

const findFirst = vi.fn();
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
    fn({ property: { findFirst } }),
}));

const { default: AdminPropertyDetailPage } = await import('./page.js');

const property = {
  id: 'p1',
  title: 'Edwardian semi',
  displayAddress: 'Palatine Road, Didsbury',
  postcode: 'M20 6RE',
  saleType: 'sale',
  marketStatus: 'for_sale',
  price: 52_500_000,
  bedrooms: 4,
  bathrooms: 2,
  receptions: 2,
  description: 'A handsome semi.',
  publishedAt: null,
};

function props(id = 'p1') {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  findFirst.mockResolvedValue(property);
});

describe('AdminPropertyDetailPage', () => {
  it('renders the listing detail (drafts included) from the tenant-scoped read', async () => {
    render(await AdminPropertyDetailPage(props()));

    expect(
      screen.getByRole('heading', { level: 1, name: 'Palatine Road, Didsbury' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('Guide price')).toBeInTheDocument();
    expect(screen.getByText('£525,000')).toBeInTheDocument();
    expect(screen.getByText('A handsome semi.')).toBeInTheDocument();
    // admin read is by id, drafts included (no published filter)
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'p1', deletedAt: null } });
  });

  it('frames a published rental and omits absent stats / description / title', async () => {
    findFirst.mockResolvedValue({
      ...property,
      title: null,
      saleType: 'rent',
      marketStatus: 'to_let',
      bedrooms: null,
      bathrooms: null,
      receptions: null,
      description: null,
      publishedAt: new Date('2026-06-01T00:00:00.000Z'),
    });

    render(await AdminPropertyDetailPage(props()));

    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.getByText('To rent')).toBeInTheDocument();
    expect(screen.getByText('Asking rent')).toBeInTheDocument(); // rent qualifier
    expect(screen.queryByText('Bedrooms')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Description' })).not.toBeInTheDocument();
  });

  it('404s an unknown listing', async () => {
    findFirst.mockResolvedValue(null);
    await expect(AdminPropertyDetailPage(props('nope'))).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
