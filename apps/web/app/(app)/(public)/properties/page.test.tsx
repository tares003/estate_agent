// responsive-coverage: opt-out all — asserts the data→grid composition, filter
// query wiring, chips and pagination; the responsive filter-bar / grid layout is
// covered by the page-level Playwright e2e pass (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

vi.mock('../../lib/tenant.js', () => ({
  getCurrentTenantId: async () => 'tenant-1',
  getRequestOrigin: async () => 'https://acme.test',
}));
vi.mock('../../lib/db.js', () => ({ getDb: () => ({}) }));

const findMany = vi.fn();
const count = vi.fn();
const queryRawUnsafe = vi.fn(async (sql: string) =>
  String(sql).includes('count(*)') ? [{ count: 1 }] : [row],
);
const imageFindMany = vi.fn();
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
    fn({
      property: { findMany, count },
      propertyImage: { findMany: imageFindMany },
      $queryRawUnsafe: queryRawUnsafe,
    }),
}));
vi.mock('../../lib/storage.js', () => ({
  signedObjectPath: (key: string) => `/api/storage/object?token=tok:${key}`,
}));

const { default: CataloguePage, generateMetadata } = await import('./page.js');

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
  imageFindMany.mockResolvedValue([
    {
      propertyId: 'p1',
      url: 'tenants/t1/properties/p1/a.jpg',
      alt: 'The front elevation',
      width: 1200,
    },
  ]);
});

describe('CataloguePage', () => {
  it('renders a PropertyCard grid + count from the tenant-scoped search', async () => {
    render(await CataloguePage(params({})));

    expect(screen.getByRole('heading', { level: 1, name: 'Properties' })).toBeInTheDocument();
    expect(screen.getByText('£525,000')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edwardian semi · 4 bed' })).toBeInTheDocument();
    expect(screen.getByText('1 property')).toBeInTheDocument();
    // the card carries the listing's hero image via a render-time signed path
    expect(screen.getByAltText('The front elevation')).toHaveAttribute(
      'src',
      '/api/storage/object?token=tok:tenants/t1/properties/p1/a.thumb.jpg',
    );
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
          location: 'Didsbury',
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
          OR: [
            { town: { contains: 'Didsbury', mode: 'insensitive' } },
            { postcode: { startsWith: 'DIDSBURY' } },
          ],
        },
      }),
    );
    // the location chip renders end-to-end
    const chips = screen.getByRole('list', { name: 'Active filters' });
    expect(within(chips).getByText('In Didsbury')).toBeInTheDocument();
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

  it('uses the PostGIS radius query (not Prisma) when a centre point + radius are given', async () => {
    render(await CataloguePage(params({ lat: '51.5074', lng: '-0.1278', radius: '5' })));

    expect(findMany).not.toHaveBeenCalled(); // the Prisma path is bypassed
    const rawCall = queryRawUnsafe.mock.calls.find(([sql]) => String(sql).includes('ST_DWithin'));
    expect(rawCall).toBeDefined();
    expect(rawCall?.slice(1)).toContain(8047); // 5 mi → 8047 m bound into the query

    const chips = screen.getByRole('list', { name: 'Active filters' });
    expect(within(chips).getByText('Within 5 mi')).toBeInTheDocument();
  });

  it('uses km when unit=km is given', async () => {
    render(await CataloguePage(params({ lat: '51.5', lng: '-0.1', radius: '4', unit: 'km' })));

    const rawCall = queryRawUnsafe.mock.calls.find(([sql]) => String(sql).includes('ST_DWithin'));
    expect(rawCall?.slice(1)).toContain(4000); // 4 km → 4000 m
    const chips = screen.getByRole('list', { name: 'Active filters' });
    expect(within(chips).getByText('Within 4 km')).toBeInTheDocument();
  });

  it('generateMetadata emits canonical, OG and Twitter for the catalogue (FR-O-4)', async () => {
    const meta = await generateMetadata();
    expect(meta.title).toBe('Property search');
    expect(meta.alternates?.canonical).toBe('https://acme.test/properties');
    expect(meta.openGraph?.url).toBe('https://acme.test/properties');
    expect(meta.twitter).toMatchObject({ card: 'summary_large_image' });
  });
});
