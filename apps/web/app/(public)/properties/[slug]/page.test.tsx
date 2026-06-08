// responsive-coverage: opt-out all — this asserts the data → detail composition
// and the 404 path; the responsive two-column layout is covered by the
// page-level Playwright e2e pass (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../lib/tenant.js', () => ({ getCurrentTenantId: async () => 'tenant-1' }));
vi.mock('../../../lib/db.js', () => ({ getDb: () => ({}) }));

const findFirst = vi.fn();
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _tenantId: string, fn: (tx: unknown) => unknown) =>
    fn({ property: { findFirst } }),
}));

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

const { default: PropertyDetailPage } = await import('./page.js');

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

beforeEach(() => vi.clearAllMocks());

describe('PropertyDetailPage', () => {
  it('renders the property detail and wires the enquiry form to the property id', async () => {
    findFirst.mockResolvedValue(saleRow);

    render(await PropertyDetailPage({ params: Promise.resolve({ slug: 'palatine-road-m20' }) }));

    expect(findFirst).toHaveBeenCalledWith({
      where: { slug: 'palatine-road-m20', publishedAt: { not: null }, deletedAt: null },
    });
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
});
