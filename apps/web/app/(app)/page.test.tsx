// responsive-coverage: opt-out all — page-level responsive layout and route-level
// axe/perf are verified by a Playwright e2e pass against the running app. These
// jsdom tests assert content, landmarks, the search entry and the featured strip.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('./lib/tenant.js', () => ({ getCurrentTenantId: async () => 'tenant-1' }));
vi.mock('./lib/db.js', () => ({ getDb: () => ({}) }));

const findMany = vi.fn();
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
    fn({ property: { findMany } }),
}));

const { default: HomePage } = await import('./page.js');

const featuredRow = {
  id: 'p1',
  slug: 'edwardian-semi-m20',
  displayAddress: 'Palatine Road, Didsbury',
  postcode: 'M20',
  title: 'Edwardian semi with south-facing garden',
  saleType: 'sale',
  marketStatus: 'for_sale',
  price: 52_500_000,
  bedrooms: 4,
  bathrooms: 2,
  category: 'house',
};

beforeEach(() => {
  vi.clearAllMocks();
  findMany.mockResolvedValue([featuredRow]);
});

describe('HomePage', () => {
  it('leads with the hero heading and a property search as the primary action', async () => {
    render(await HomePage());

    expect(
      screen.getByRole('heading', { level: 1, name: /Move with people/i }),
    ).toBeInTheDocument();
    // The primary acquisition surface: a search form that navigates to the catalogue.
    const form = screen.getByRole('button', { name: 'Search' }).closest('form');
    expect(form).toHaveAttribute('action', '/properties');
    expect(form).toHaveAttribute('method', 'get');
  });

  it('renders a featured strip drawn from the live catalogue', async () => {
    render(await HomePage());

    // The featured query pulls flagged, published properties.
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isFeatured: true, publishedAt: { not: null }, deletedAt: null },
      }),
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Featured homes' })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Edwardian semi with south-facing garden/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View all properties' })).toHaveAttribute(
      'href',
      '/properties',
    );
  });

  it('exposes a main landmark, a heading hierarchy and the three journeys as links', async () => {
    render(await HomePage());

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThanOrEqual(2);
    // Each journey is a real navigation entry point, not an inert card.
    expect(screen.getByRole('link', { name: 'Browse properties' })).toHaveAttribute(
      'href',
      '/properties',
    );
    expect(screen.getByRole('link', { name: 'Get a valuation' })).toHaveAttribute(
      'href',
      '/valuation',
    );
    expect(screen.getByRole('link', { name: 'Report a repair' })).toHaveAttribute(
      'href',
      '/report-a-repair',
    );
  });
});
