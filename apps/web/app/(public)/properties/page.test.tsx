// responsive-coverage: opt-out all — asserts the data→grid composition, filter
// query wiring, chips and pagination; the responsive filter-bar / grid layout is
// covered by the page-level Playwright e2e pass (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

vi.mock('../../lib/tenant.js', () => ({ getCurrentTenantId: async () => 'tenant-1' }));
vi.mock('../../lib/db.js', () => ({ getDb: () => ({}) }));

const findMany = vi.fn();
const count = vi.fn();
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
    fn({ property: { findMany, count } }),
}));

const { default: CataloguePage } = await import('./page.js');

const row = {
  id: 'p1',
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

function params(p: Record<string, string>) {
  return { searchParams: Promise.resolve(p) };
}

beforeEach(() => {
  vi.clearAllMocks();
  findMany.mockResolvedValue([row]);
  count.mockResolvedValue(1);
});

describe('CataloguePage', () => {
  it('renders a PropertyCard grid + count from the tenant-scoped search', async () => {
    render(await CataloguePage(params({})));

    expect(screen.getByRole('heading', { level: 1, name: 'Properties' })).toBeInTheDocument();
    expect(screen.getByText('£525,000')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edwardian semi · 4 bed' })).toBeInTheDocument();
    expect(screen.getByText('1 property')).toBeInTheDocument();
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { publishedAt: { not: null }, deletedAt: null },
        orderBy: { publishedAt: 'desc' },
        skip: 0,
        take: 24,
      }),
    );
  });

  it('reflects the rent filter in the heading and the query', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    render(await CataloguePage(params({ saleType: 'rent' })));

    expect(
      screen.getByRole('heading', { level: 1, name: 'Properties to rent' }),
    ).toBeInTheDocument();
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ saleType: 'rent' }) }),
    );
    expect(screen.getByText(/No properties match/i)).toBeInTheDocument();
    // zero results → a single page → no pagination nav
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull();
  });

  it('threads the chosen sort through to the query', async () => {
    render(await CataloguePage(params({ sort: 'price_asc' })));

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { price: { sort: 'asc', nulls: 'last' } } }),
    );
  });

  it('maps every filter into the query, converting £ prices to pence', async () => {
    render(
      await CataloguePage(
        params({
          saleType: 'rent',
          listingType: 'residential',
          priceMin: '100000',
          priceMax: '500000',
          bedroomsMin: '2',
          bathroomsMin: '1',
        }),
      ),
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          publishedAt: { not: null },
          deletedAt: null,
          saleType: 'rent',
          listingType: 'residential',
          price: { gte: 10_000_000, lte: 50_000_000 },
          bedrooms: { gte: 2 },
          bathrooms: { gte: 1 },
        },
      }),
    );
  });

  it('renders removable chips for the active filters', async () => {
    render(await CataloguePage(params({ saleType: 'rent', bedroomsMin: '2' })));

    const chips = screen.getByRole('list', { name: 'Active filters' });
    expect(within(chips).getByText('To rent')).toBeInTheDocument();
    expect(within(chips).getByText('2+ beds')).toBeInTheDocument();
    // the saleType chip's link clears just that filter
    const removeRent = within(chips).getByText('To rent').closest('a');
    expect(removeRent).toHaveAttribute('href', '/properties?bedroomsMin=2');
  });

  it('shows pagination when there is more than one page', async () => {
    count.mockResolvedValue(50);

    render(await CataloguePage(params({})));

    const nav = screen.getByRole('navigation', { name: 'Pagination' });
    expect(within(nav).getByText('Page 1 of 3')).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: /Next/ })).toHaveAttribute(
      'href',
      '/properties?page=2',
    );
    // on page 1 there is no Previous link (it is disabled)
    expect(within(nav).queryByRole('link', { name: /Previous/ })).toBeNull();
  });

  it('disables Next and links Previous on the last page', async () => {
    count.mockResolvedValue(50); // ceil(50 / 24) = 3 pages

    render(await CataloguePage(params({ page: '3' })));

    const nav = screen.getByRole('navigation', { name: 'Pagination' });
    expect(within(nav).getByText('Page 3 of 3')).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: /Previous/ })).toHaveAttribute(
      'href',
      '/properties?page=2',
    );
    expect(within(nav).queryByRole('link', { name: /Next/ })).toBeNull();
  });
});
