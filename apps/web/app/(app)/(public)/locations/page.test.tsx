// responsive-coverage: opt-out all — this asserts the data → grid composition,
// the card links, the hero image and the empty state; the responsive card grid +
// hover lift is covered by the page-level Playwright e2e pass (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../lib/tenant.js', () => ({
  getCurrentTenantId: async () => 'tenant-1',
  getRequestOrigin: async () => 'https://acme.test',
}));
vi.mock('../../lib/db.js', () => ({ getDb: () => ({}) }));
vi.mock('../../lib/storage.js', () => ({
  signedObjectPath: (key: string) => `/api/storage/object?token=tok:${key}`,
}));

const findMany = vi.fn();
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _tenantId: string, fn: (tx: unknown) => unknown) =>
    fn({ areaGuide: { findMany } }),
}));

const { default: LocationsPage, generateMetadata } = await import('./page.js');

const CHORLTON = {
  slug: 'chorlton',
  name: 'Chorlton',
  introduction: 'A bohemian quarter of south Manchester.',
  heroImage: 'tenants/t1/area-guides/g2/hero.jpg',
};
const DIDSBURY = {
  slug: 'didsbury',
  name: 'Didsbury',
  introduction: 'A leafy suburb in south Manchester.',
  heroImage: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LocationsPage', () => {
  it('renders a card per published guide, linking to its detail page', async () => {
    findMany.mockResolvedValue([CHORLTON, DIDSBURY]);

    render(await LocationsPage());

    // The list read filters to published guides only (drafts never leak), by name.
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'published' },
        orderBy: { name: 'asc' },
      }),
    );
    expect(screen.getByRole('link', { name: 'Chorlton' })).toHaveAttribute(
      'href',
      '/locations/chorlton',
    );
    expect(screen.getByRole('link', { name: 'Didsbury' })).toHaveAttribute(
      'href',
      '/locations/didsbury',
    );
    expect(screen.getByText('A bohemian quarter of south Manchester.')).toBeInTheDocument();
    expect(screen.getByText('2 area guides')).toBeInTheDocument();
  });

  it('serves the hero image via a render-time signed path', async () => {
    findMany.mockResolvedValue([CHORLTON]);

    render(await LocationsPage());

    expect(screen.getByAltText('Chorlton area guide')).toHaveAttribute(
      'src',
      '/api/storage/object?token=tok:tenants/t1/area-guides/g2/hero.jpg',
    );
    expect(screen.getByText('1 area guide')).toBeInTheDocument();
  });

  it('omits the image when a guide has no hero image', async () => {
    findMany.mockResolvedValue([DIDSBURY]);

    render(await LocationsPage());

    expect(screen.queryByAltText('Didsbury area guide')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Didsbury' })).toBeInTheDocument();
  });

  it('renders the empty state when there are no published guides', async () => {
    findMany.mockResolvedValue([]);

    render(await LocationsPage());

    expect(screen.getByText('No area guides')).toBeInTheDocument();
    expect(screen.getByText(/No area guides to show just yet/i)).toBeInTheDocument();
  });

  it('emits a canonical, OG and Twitter metadata set (FR-O-4)', async () => {
    const meta = await generateMetadata();
    expect(meta.title).toBe('Area guides');
    expect(meta.alternates?.canonical).toBe('https://acme.test/locations');
    expect(meta.openGraph?.url).toBe('https://acme.test/locations');
    expect(meta.twitter).toMatchObject({ card: 'summary_large_image' });
  });
});
