// responsive-coverage: opt-out all — the catalogue's responsive grid is verified
// by the page-level Playwright e2e pass; this asserts the data → PropertyCard
// composition (real repository + format) and the empty state.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../lib/tenant.js', () => ({ getCurrentTenantId: async () => 'tenant-1' }));
vi.mock('../../lib/db.js', () => ({ getDb: () => ({}) }));

const findMany = vi.fn();
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _tenantId: string, fn: (tx: unknown) => unknown) =>
    fn({ property: { findMany } }),
}));

const { default: CataloguePage } = await import('./page.js');

const row = {
  slug: 'palatine-road-m20',
  displayAddress: 'Palatine Road, Didsbury',
  postcode: 'M20',
  title: 'Edwardian semi · 4 bed',
  saleType: 'sale',
  marketStatus: 'for_sale',
  price: 52_500_000,
  bedrooms: 4,
  bathrooms: 2,
  receptions: 2,
};

describe('CataloguePage', () => {
  it('renders a PropertyCard grid from the tenant-scoped listing query', async () => {
    findMany.mockResolvedValue([row]);
    render(await CataloguePage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole('heading', { level: 1, name: /Properties/ })).toBeInTheDocument();
    expect(screen.getByText('£525,000')).toBeInTheDocument();
    expect(screen.getByText('Guide price')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edwardian semi · 4 bed' })).toBeInTheDocument();
  });

  it('shows an empty state when there are no matches', async () => {
    findMany.mockResolvedValue([]);
    render(await CataloguePage({ searchParams: Promise.resolve({ saleType: 'rent' }) }));
    expect(screen.getByText(/No properties match/i)).toBeInTheDocument();
  });

  it('reflects the sale filter in the heading', async () => {
    findMany.mockResolvedValue([]);
    render(await CataloguePage({ searchParams: Promise.resolve({ saleType: 'sale' }) }));
    expect(
      screen.getByRole('heading', { level: 1, name: /Properties for sale/i }),
    ).toBeInTheDocument();
  });
});
