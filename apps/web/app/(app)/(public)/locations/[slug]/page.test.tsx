// responsive-coverage: opt-out all — asserts the data→page composition (hero,
// intro, page-builder sections, the area-property grid + hero images, Place /
// Breadcrumb JSON-LD and the metadata); the responsive hero / grid layout is
// covered by the page-level Playwright e2e pass (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../lib/tenant.js', () => ({
  getCurrentTenantId: async () => 'tenant-1',
  getRequestOrigin: async () => 'https://acme.test',
}));
vi.mock('../../../lib/db.js', () => ({ getDb: () => ({}) }));
vi.mock('../../../lib/storage.js', () => ({
  signedObjectPath: (key: string) => `/api/storage/object?token=tok:${key}`,
}));

const guideFindFirst = vi.fn();
const sectionFindMany = vi.fn();
const propertyFindMany = vi.fn();
const imageFindMany = vi.fn();
const seoFindFirst = vi.fn();
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
    fn({
      areaGuide: { findFirst: guideFindFirst },
      areaGuideSection: { findMany: sectionFindMany },
      property: { findMany: propertyFindMany },
      propertyImage: { findMany: imageFindMany },
      seoMetadata: { findFirst: seoFindFirst },
    }),
}));

const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', () => ({ notFound }));

const { default: AreaGuidePage, generateMetadata } = await import('./page.js');

const GUIDE = {
  id: 'g1',
  slug: 'didsbury',
  name: 'Didsbury',
  introduction: 'A leafy suburb in south Manchester.',
  heroImage: 'tenants/t1/area-guides/g1/hero.jpg',
  postcodePrefixes: ['M20', 'M21'],
  latitude: 53.41,
  longitude: -2.23,
  metaTitle: 'Living in Didsbury',
  metaDescription: 'Your complete guide to Didsbury.',
};

const PROPERTY = {
  id: 'p1',
  slug: 'palatine-road-m20',
  displayAddress: 'Palatine Road, Didsbury',
  postcode: 'M20 2QR',
  title: 'Edwardian semi · 4 bed',
  saleType: 'sale',
  marketStatus: 'for_sale',
  price: 52_500_000,
  bedrooms: 4,
  bathrooms: 2,
  receptions: 2,
};

function params(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  seoFindFirst.mockResolvedValue(null);
  guideFindFirst.mockResolvedValue(GUIDE);
  sectionFindMany.mockResolvedValue([
    { type: 'rich_text', data: { html: '<p>Transport links</p>' } },
  ]);
  propertyFindMany.mockResolvedValue([PROPERTY]);
  imageFindMany.mockResolvedValue([
    {
      propertyId: 'p1',
      url: 'tenants/t1/properties/p1/a.jpg',
      alt: 'The front elevation',
      width: 1200,
    },
  ]);
});

describe('AreaGuidePage', () => {
  it('renders the hero, introduction, page-builder sections and the area-property grid', async () => {
    render(await AreaGuidePage(params('didsbury')));

    expect(screen.getByRole('heading', { level: 1, name: 'Didsbury' })).toBeInTheDocument();
    expect(screen.getByText('A leafy suburb in south Manchester.')).toBeInTheDocument();
    // the hero image is served via a render-time signed path
    expect(screen.getByAltText('Didsbury area guide')).toHaveAttribute(
      'src',
      '/api/storage/object?token=tok:tenants/t1/area-guides/g1/hero.jpg',
    );
    // the page-builder section renders via the shared PageRenderer
    expect(screen.getByText('Transport links')).toBeInTheDocument();
    // the area property renders as a card with its hero image
    expect(screen.getByRole('link', { name: 'Edwardian semi · 4 bed' })).toBeInTheDocument();
    expect(screen.getByText('£525,000')).toBeInTheDocument();
    expect(screen.getByAltText('The front elevation')).toHaveAttribute(
      'src',
      '/api/storage/object?token=tok:tenants/t1/properties/p1/a.thumb.jpg',
    );
    // only the published guide is fetched, and properties match the guide prefixes
    expect(guideFindFirst.mock.calls[0]![0]).toMatchObject({
      where: { slug: 'didsbury', status: 'published' },
    });
    expect(propertyFindMany.mock.calls[0]![0]).toMatchObject({
      where: {
        OR: [{ postcode: { startsWith: 'M20' } }, { postcode: { startsWith: 'M21' } }],
      },
    });
  });

  it('emits Place and BreadcrumbList JSON-LD (FR-O-7 / FR-O-6)', async () => {
    const { container } = render(await AreaGuidePage(params('didsbury')));
    const scripts = [...container.querySelectorAll('script[type="application/ld+json"]')].map(
      (node) => JSON.parse(node.textContent ?? '{}'),
    );
    const place = scripts.find((ld) => ld['@type'] === 'Place');
    expect(place).toMatchObject({
      '@type': 'Place',
      name: 'Didsbury',
      description: 'A leafy suburb in south Manchester.',
      url: 'https://acme.test/locations/didsbury',
      geo: { latitude: 53.41, longitude: -2.23 },
    });
    const crumbs = scripts.find((ld) => ld['@type'] === 'BreadcrumbList');
    expect(crumbs?.itemListElement).toHaveLength(3);
    expect(crumbs?.itemListElement?.[2]).toMatchObject({ name: 'Didsbury' });
  });

  it('renders the empty state when no properties match the area prefixes', async () => {
    propertyFindMany.mockResolvedValue([]);
    render(await AreaGuidePage(params('didsbury')));
    expect(screen.getByText(/No properties are listed in Didsbury/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse all properties' })).toBeInTheDocument();
  });

  it('404s for an unknown / unpublished slug', async () => {
    guideFindFirst.mockResolvedValue(null);
    await expect(AreaGuidePage(params('nope'))).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });

  it('generateMetadata emits the guide meta title / description, canonical, OG and Twitter', async () => {
    const meta = await generateMetadata(params('didsbury'));
    expect(meta.title).toBe('Living in Didsbury');
    expect(meta.description).toBe('Your complete guide to Didsbury.');
    expect(meta.alternates?.canonical).toBe('https://acme.test/locations/didsbury');
    expect(meta.openGraph?.url).toBe('https://acme.test/locations/didsbury');
    expect(meta.twitter).toMatchObject({ card: 'summary_large_image' });
  });

  it('generateMetadata falls back to the guide name / introduction when meta fields are unset', async () => {
    guideFindFirst.mockResolvedValue({ ...GUIDE, metaTitle: null, metaDescription: null });
    const meta = await generateMetadata(params('didsbury'));
    expect(meta.title).toBe('Didsbury area guide');
    expect(meta.description).toBe('A leafy suburb in south Manchester.');
  });

  it('generateMetadata returns a not-found title for an unknown slug', async () => {
    guideFindFirst.mockResolvedValue(null);
    const meta = await generateMetadata(params('nope'));
    expect(meta.title).toBe('Area guide not found');
  });

  it('generateMetadata applies a per-area-guide SEO override over the defaults (FR-O-4)', async () => {
    seoFindFirst.mockResolvedValue({
      id: 's1',
      scope: 'area_guide',
      scopeId: GUIDE.id,
      metaTitle: 'Override guide title',
      metaDescription: 'Override guide description.',
      canonicalUrl: 'https://acme.test/canonical/didsbury',
      ogImage: 'https://acme.test/social/didsbury.jpg',
      noIndex: true,
      noFollow: true,
      structuredData: null,
    });

    const meta = await generateMetadata(params('didsbury'));

    expect(seoFindFirst).toHaveBeenCalledWith({
      where: { scope: 'area_guide', scopeId: GUIDE.id },
    });
    expect(meta.title).toBe('Override guide title');
    expect(meta.description).toBe('Override guide description.');
    expect(meta.alternates?.canonical).toBe('https://acme.test/canonical/didsbury');
    expect((meta.openGraph as { images?: unknown[] }).images).toEqual([
      'https://acme.test/social/didsbury.jpg',
    ]);
    expect(meta.robots).toEqual({ index: false, follow: false });
  });
});
