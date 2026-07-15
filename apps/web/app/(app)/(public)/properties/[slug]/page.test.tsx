// responsive-coverage: opt-out all — this asserts the data → detail composition
// and the 404 path; the responsive two-column layout is covered by the
// page-level Playwright e2e pass (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../lib/tenant.js', () => ({
  getCurrentTenantId: async () => 'tenant-1',
  getRequestOrigin: async () => 'https://acme.test',
}));
vi.mock('../../../lib/db.js', () => ({ getDb: () => ({}) }));

const findFirst = vi.fn();
const imageFindMany = vi.fn();
const seoFindFirst = vi.fn();
const savedFindMany = vi.fn();
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _tenantId: string, fn: (tx: unknown) => unknown) =>
    fn({
      property: { findFirst },
      propertyImage: { findMany: imageFindMany },
      seoMetadata: { findFirst: seoFindFirst },
      savedProperty: { findMany: savedFindMany },
    }),
}));
vi.mock('../../../lib/storage.js', () => ({
  signedObjectPath: (key: string) => `/api/storage/object?token=tok:${key}`,
}));

// EPIC-T FR-T-5/6 — the detail page resolves the customer session to decide the
// save-to-favourites affordance; default to signed-out so the existing detail
// assertions are unaffected.
const getCustomerSession = vi.fn();
vi.mock('../../../lib/customer-session.js', () => ({ getCustomerSession }));

const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', () => ({ notFound }));

vi.mock('./EnquiryForm.js', () => ({
  EnquiryForm: ({ propertyId, propertyTitle }: { propertyId: string; propertyTitle: string }) => (
    <div data-testid="enquiry-form" data-property-id={propertyId}>
      {propertyTitle}
    </div>
  ),
}));

// The client save/remove toggle is exercised in its own test; stub it here so the
// detail-page test asserts the WIRING (property id, verified-customer flag, saved
// state, return path) without pulling in the client-only hooks.
vi.mock('../../../account/saved/SavePropertyButton.js', () => ({
  SavePropertyButton: ({
    propertyId,
    signedIn,
    initialSaved,
    currentPath,
  }: {
    propertyId: string;
    signedIn: boolean;
    initialSaved: boolean;
    currentPath?: string;
  }) => (
    <div
      data-testid="save-button"
      data-property-id={propertyId}
      data-signed-in={String(signedIn)}
      data-initial-saved={String(initialSaved)}
      data-current-path={currentPath}
    />
  ),
}));

const { default: PropertyDetailPage, generateMetadata } = await import('./page.js');

const saleRow = {
  id: '11111111-1111-1111-1111-111111111111',
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
  description: 'A handsome Edwardian semi moments from the village.',
};

beforeEach(() => {
  vi.clearAllMocks();
  seoFindFirst.mockResolvedValue(null);
  // Default: a signed-out visitor with no saved rows — the save control renders as
  // a sign-in prompt and the saved-state read is skipped.
  getCustomerSession.mockResolvedValue(null);
  savedFindMany.mockResolvedValue([]);
  imageFindMany.mockResolvedValue([
    {
      id: 'i1',
      url: 'tenants/t1/properties/p1/a.jpg',
      alt: 'The front elevation',
      sortOrder: 0,
      isPrimary: true,
      width: 1200,
    },
    {
      id: 'i2',
      url: 'tenants/t1/properties/p1/b.jpg',
      alt: 'The kitchen',
      sortOrder: 1,
      isPrimary: false,
    },
  ]);
});

describe('PropertyDetailPage', () => {
  it('renders the property detail and wires the enquiry form to the property id', async () => {
    findFirst.mockResolvedValue(saleRow);

    const { container } = render(
      await PropertyDetailPage({ params: Promise.resolve({ slug: 'palatine-road-m20' }) }),
    );

    expect(findFirst).toHaveBeenCalledWith({
      where: { slug: 'palatine-road-m20', publishedAt: { not: null }, deletedAt: null },
    });

    // the gallery: the hero leads, every image alt-texted (G9), signed paths
    expect(screen.getByAltText('The front elevation')).toHaveAttribute(
      'src',
      '/api/storage/object?token=tok:tenants/t1/properties/p1/a.large.jpg',
    );
    // an unprocessed image still serves its original
    expect(screen.getByAltText('The kitchen')).toHaveAttribute(
      'src',
      '/api/storage/object?token=tok:tenants/t1/properties/p1/b.jpg',
    );

    // EPIC-O structured data: a RealEstateListing + a BreadcrumbList (FR-O-5/6).
    const ldScripts = container.querySelectorAll('script[type="application/ld+json"]');
    expect(ldScripts).toHaveLength(2);
    const listing = JSON.parse(ldScripts[0]?.textContent ?? '{}');
    expect(listing['@type']).toBe('RealEstateListing');
    expect(listing.name).toBe('Edwardian semi · 4 bed');
    expect(listing.url).toBe('https://acme.test/properties/palatine-road-m20');
    expect(listing.offers).toMatchObject({ price: 525000, priceCurrency: 'GBP' });
    expect(JSON.parse(ldScripts[1]?.textContent ?? '{}')['@type']).toBe('BreadcrumbList');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Edwardian semi · 4 bed' }),
    ).toBeInTheDocument();
    expect(screen.getByText('£525,000')).toBeInTheDocument();
    expect(screen.getByText('Guide price')).toBeInTheDocument();
    expect(screen.getByText(/handsome Edwardian semi/i)).toBeInTheDocument();
    expect(screen.getByText('Bedrooms')).toBeInTheDocument();

    const form = screen.getByTestId('enquiry-form');
    expect(form).toHaveAttribute('data-property-id', '11111111-1111-1111-1111-111111111111');
    expect(form).toHaveTextContent('Edwardian semi · 4 bed');

    // a "Book a viewing" link to the per-property viewing route
    expect(screen.getByRole('link', { name: 'Book a viewing' })).toHaveAttribute(
      'href',
      '/properties/palatine-road-m20/viewing',
    );
  });

  // EPIC-T FR-T-5 — the detail page carries the save-to-favourites control, wired to
  // this property and to the return path for a signed-out visitor (no saved-state read).
  it('wires the save-to-favourites control to the property (signed out)', async () => {
    findFirst.mockResolvedValue(saleRow);

    render(await PropertyDetailPage({ params: Promise.resolve({ slug: 'palatine-road-m20' }) }));

    const save = screen.getByTestId('save-button');
    expect(save).toHaveAttribute('data-property-id', saleRow.id);
    expect(save).toHaveAttribute('data-signed-in', 'false');
    expect(save).toHaveAttribute('data-current-path', '/properties/palatine-road-m20');
    // signed out → the persisted saved-state read is never issued
    expect(savedFindMany).not.toHaveBeenCalled();
  });

  // EPIC-T FR-T-6 — for a verified customer the control reflects the persisted saved
  // state, read tenant-scoped and scoped to their own rows + this property.
  it('reflects the persisted saved state for a verified customer', async () => {
    findFirst.mockResolvedValue(saleRow);
    getCustomerSession.mockResolvedValue({
      userId: 'c1',
      emailVerified: true,
      actor: 'customer:c1',
    });
    savedFindMany.mockResolvedValue([{ propertyId: saleRow.id }]);

    render(await PropertyDetailPage({ params: Promise.resolve({ slug: 'palatine-road-m20' }) }));

    const save = screen.getByTestId('save-button');
    expect(save).toHaveAttribute('data-signed-in', 'true');
    expect(save).toHaveAttribute('data-initial-saved', 'true');
    expect(savedFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'c1', propertyId: { in: [saleRow.id] } },
        select: { propertyId: true },
      }),
    );
  });

  // §C.11 — the facts strip carries the square footage; §O.3 / FR-O-5 — the same size is
  // emitted as the RealEstateListing's `floorSize`. One row, both surfaces.
  it('renders the square footage in the facts strip and emits it as floorSize', async () => {
    findFirst.mockResolvedValue({ ...saleRow, internalSqft: 1450 });

    const { container } = render(
      await PropertyDetailPage({ params: Promise.resolve({ slug: 'palatine-road-m20' }) }),
    );

    expect(screen.getByText('Size')).toBeInTheDocument();
    // The size shows in the facts strip AND the Material Information panel (both surfaces).
    expect(screen.getAllByText('1,450 sq ft').length).toBeGreaterThanOrEqual(1);

    const ldScripts = container.querySelectorAll('script[type="application/ld+json"]');
    const listing = JSON.parse(ldScripts[0]?.textContent ?? '{}');
    expect(listing.floorSize).toEqual({
      '@type': 'QuantitativeValue',
      value: 1450,
      unitCode: 'FTK',
    });
  });

  it('omits the size fact and floorSize when the listing has no measured size', async () => {
    findFirst.mockResolvedValue(saleRow);

    const { container } = render(
      await PropertyDetailPage({ params: Promise.resolve({ slug: 'palatine-road-m20' }) }),
    );

    expect(screen.queryByText('Size')).not.toBeInTheDocument();
    const ldScripts = container.querySelectorAll('script[type="application/ld+json"]');
    const listing = JSON.parse(ldScripts[0]?.textContent ?? '{}');
    expect(listing).not.toHaveProperty('floorSize');
  });

  // §F Material Information (Property Ombudsman Parts A/B/C; PRODUCT.md rule #4) — the
  // detail surfaces EPC, council tax, tenure and size, the key features, and the area.
  it('renders the Material Information panel, key features and area when populated', async () => {
    findFirst.mockResolvedValue({
      ...saleRow,
      epcRating: 'd',
      epcScore: 62,
      councilTaxBand: 'e',
      tenure: 'freehold',
      internalSqft: 1680,
      keyFeatures: ['South-facing garden', 'Off-street parking'],
      shortDescription: 'A handsome four-bed semi near the village.',
      areaDescription: 'Didsbury has a village high street of independent cafes.',
    });

    render(await PropertyDetailPage({ params: Promise.resolve({ slug: 'palatine-road-m20' }) }));

    expect(screen.getByRole('heading', { name: 'Material information' })).toBeInTheDocument();
    expect(screen.getByText('EPC rating')).toBeInTheDocument();
    expect(screen.getByText('D · 62')).toBeInTheDocument();
    expect(screen.getByText('Council tax band')).toBeInTheDocument();
    expect(screen.getByText('Freehold')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Key features' })).toBeInTheDocument();
    expect(screen.getByText('South-facing garden')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'The area' })).toBeInTheDocument();
    expect(screen.getByText('A handsome four-bed semi near the village.')).toBeInTheDocument();
  });

  it('omits Material Information, key features and area when the listing populates none', async () => {
    findFirst.mockResolvedValue(saleRow);

    render(await PropertyDetailPage({ params: Promise.resolve({ slug: 'palatine-road-m20' }) }));

    expect(screen.queryByRole('heading', { name: 'Material information' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Key features' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'The area' })).not.toBeInTheDocument();
  });

  it('renders a minimal property with no description or stats', async () => {
    findFirst.mockResolvedValue({
      id: '22222222-2222-2222-2222-222222222222',
      slug: 'studio-m1',
      displayAddress: 'Whitworth Street, Manchester',
      postcode: 'M1',
      title: null,
      saleType: 'rent',
      marketStatus: 'to_let',
      price: 95_000,
      bedrooms: null,
      bathrooms: null,
      receptions: null,
      description: null,
    });

    render(await PropertyDetailPage({ params: Promise.resolve({ slug: 'studio-m1' }) }));

    // Title falls back to the address; no stat list, no description paragraph.
    expect(
      screen.getByRole('heading', { level: 1, name: 'Whitworth Street, Manchester' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Bedrooms')).not.toBeInTheDocument();
    expect(screen.getByText('PCM', { exact: false })).toBeInTheDocument();
  });

  it('calls notFound() when the slug resolves to no published property', async () => {
    findFirst.mockResolvedValue(null);

    await expect(
      PropertyDetailPage({ params: Promise.resolve({ slug: 'ghost' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });

  describe('generateMetadata', () => {
    it('emits a canonical, OG and Twitter metadata set (FR-O-4)', async () => {
      findFirst.mockResolvedValue(saleRow);

      const meta = await generateMetadata({
        params: Promise.resolve({ slug: 'palatine-road-m20' }),
      });

      expect(meta.title).toBe('Edwardian semi · 4 bed');
      expect(meta.alternates?.canonical).toBe('https://acme.test/properties/palatine-road-m20');
      expect(meta.openGraph?.url).toBe('https://acme.test/properties/palatine-road-m20');
      expect(meta.twitter).toMatchObject({ card: 'summary_large_image' });
      expect((meta.description ?? '').length).toBeLessThanOrEqual(160);
    });

    it('returns a not-found title when the slug is unknown', async () => {
      findFirst.mockResolvedValue(null);
      const meta = await generateMetadata({ params: Promise.resolve({ slug: 'ghost' }) });
      expect(meta.title).toBe('Property not found');
    });

    it('applies a per-property SEO override over the defaults (FR-O-4)', async () => {
      findFirst.mockResolvedValue(saleRow);
      seoFindFirst.mockResolvedValue({
        id: 's1',
        scope: 'property',
        scopeId: saleRow.id,
        metaTitle: 'Curated headline',
        metaDescription: 'Curated description.',
        canonicalUrl: 'https://acme.test/canonical/palatine',
        ogImage: 'https://acme.test/social/palatine.jpg',
        noIndex: true,
        noFollow: false,
        structuredData: null,
      });

      const meta = await generateMetadata({
        params: Promise.resolve({ slug: 'palatine-road-m20' }),
      });

      // The resolve keys on the property scope + id, tenant-scoped via withTenant.
      expect(seoFindFirst).toHaveBeenCalledWith({
        where: { scope: 'property', scopeId: saleRow.id },
      });
      expect(meta.title).toBe('Curated headline');
      expect(meta.description).toBe('Curated description.');
      expect(meta.alternates?.canonical).toBe('https://acme.test/canonical/palatine');
      expect((meta.openGraph as { images?: unknown[] }).images).toEqual([
        'https://acme.test/social/palatine.jpg',
      ]);
      expect(meta.robots).toEqual({ index: false, follow: true });
    });

    it('keeps the defaults when no override resolves', async () => {
      findFirst.mockResolvedValue(saleRow);
      seoFindFirst.mockResolvedValue(null);

      const meta = await generateMetadata({
        params: Promise.resolve({ slug: 'palatine-road-m20' }),
      });

      expect(meta.title).toBe('Edwardian semi · 4 bed');
      expect(meta.alternates?.canonical).toBe('https://acme.test/properties/palatine-road-m20');
      expect(meta.robots).toBeUndefined();
    });
  });
});
