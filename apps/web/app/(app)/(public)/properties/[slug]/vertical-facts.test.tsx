// responsive-coverage: opt-out all — asserts the per-vertical facts strip renders the
// correct extension facts for each listing type on the public detail page; the
// responsive layout is covered by the page-level Playwright e2e pass.
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
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _tenantId: string, fn: (tx: unknown) => unknown) =>
    fn({
      property: { findFirst },
      propertyImage: { findMany: imageFindMany },
      seoMetadata: { findFirst: seoFindFirst },
    }),
}));
vi.mock('../../../lib/storage.js', () => ({
  signedObjectPath: (key: string) => `/api/storage/object?token=tok:${key}`,
}));
const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', () => ({ notFound }));
vi.mock('./EnquiryForm.js', () => ({
  EnquiryForm: () => <div data-testid="enquiry-form" />,
}));

const { default: PropertyDetailPage } = await import('./page.js');

const BASE = {
  slug: 'the-listing',
  displayAddress: 'High Street, Manchester',
  postcode: 'M1',
  title: 'A listing',
  saleType: 'sale',
  marketStatus: 'for_sale',
  price: 25_000_000,
  bedrooms: null,
  bathrooms: null,
  receptions: null,
  description: null,
  // extension columns default to null / false for a residential row
  isOffPlan: false,
  developmentName: null,
  vatPayable: null,
  annualBusinessRates: null,
  useClass: null,
  annualTurnover: null,
  grossProfit: null,
  netProfit: null,
  yearsTrading: null,
  staffCount: null,
  currentAnnualRent: null,
  isConfidential: false,
  bedCount: null,
  cqcRating: null,
  cqcInspectionUrl: null,
  isGoingConcern: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  seoFindFirst.mockResolvedValue(null);
  imageFindMany.mockResolvedValue([]);
});

async function renderSlug(slug: string) {
  return render(await PropertyDetailPage({ params: Promise.resolve({ slug }) }));
}

/** Parse every JSON-LD block the page emitted (structured-data leak assertions). */
function jsonLdBlocks(container: HTMLElement): Array<Record<string, unknown>> {
  return Array.from(container.querySelectorAll('script[type="application/ld+json"]')).map(
    (script) => JSON.parse(script.textContent ?? '{}') as Record<string, unknown>,
  );
}

describe('property detail — per-vertical facts (FR-F-3)', () => {
  it('renders no vertical facts for a residential listing', async () => {
    findFirst.mockResolvedValue({ ...BASE, id: 'p-res', listingType: 'residential' });
    await renderSlug('the-listing');
    expect(screen.queryByText('CQC rating')).not.toBeInTheDocument();
    expect(screen.queryByText('Annual turnover')).not.toBeInTheDocument();
    expect(screen.queryByText('Use class')).not.toBeInTheDocument();
  });

  it('renders care-home facts for a care_home listing', async () => {
    findFirst.mockResolvedValue({
      ...BASE,
      id: 'p-care',
      listingType: 'care_home',
      bedCount: 42,
      cqcRating: 'good',
      cqcInspectionUrl: 'https://www.cqc.org.uk/location/1-234',
      isGoingConcern: true,
    });
    await renderSlug('the-listing');
    expect(screen.getByText('Bed count')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('CQC rating')).toBeInTheDocument();
    expect(screen.getByText('Good')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /CQC inspection/i })).toHaveAttribute(
      'href',
      'https://www.cqc.org.uk/location/1-234',
    );
  });

  it('renders commercial facts for a commercial listing', async () => {
    findFirst.mockResolvedValue({
      ...BASE,
      id: 'p-com',
      listingType: 'commercial',
      vatPayable: true,
      annualBusinessRates: 12500,
      useClass: 'e',
    });
    await renderSlug('the-listing');
    expect(screen.getByText('Use class')).toBeInTheDocument();
    expect(screen.getByText('E')).toBeInTheDocument();
    expect(screen.getByText('Business rates')).toBeInTheDocument();
    expect(screen.getByText('VAT payable')).toBeInTheDocument();
  });

  it('renders new-home facts for a new_home off-plan listing', async () => {
    findFirst.mockResolvedValue({
      ...BASE,
      id: 'p-nh',
      listingType: 'new_home',
      isOffPlan: true,
      developmentName: 'The Waterside',
    });
    await renderSlug('the-listing');
    expect(screen.getByText('Development')).toBeInTheDocument();
    expect(screen.getByText('The Waterside')).toBeInTheDocument();
    expect(screen.getByText('Off-plan')).toBeInTheDocument();
  });

  it('renders business-transfer facts but hides the name/address when confidential', async () => {
    findFirst.mockResolvedValue({
      ...BASE,
      id: 'p-biz',
      listingType: 'business_transfer',
      title: 'Bianchi & Sons Bakery',
      displayAddress: '12 King Street',
      town: 'Manchester',
      postcode: 'M2 4WU',
      latitude: 53.48,
      longitude: -2.24,
      annualTurnover: 450000,
      netProfit: 90000,
      yearsTrading: 12,
      isConfidential: true,
    });
    const { container } = await renderSlug('the-listing');
    expect(screen.getByText('Annual turnover')).toBeInTheDocument();
    expect(screen.getByText('Net profit')).toBeInTheDocument();
    expect(screen.getByText('Years trading')).toBeInTheDocument();

    // §F.5 confidential flag — the business name and exact address must be ABSENT
    // from the document (header, card fields, everywhere).
    expect(screen.queryByText(/Bianchi/)).not.toBeInTheDocument();
    expect(screen.queryByText(/King Street/)).not.toBeInTheDocument();
    expect(screen.queryByText(/4WU/)).not.toBeInTheDocument();
    // The non-identifying placeholder (town + postcode prefix) renders instead.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Manchester, M2');

    // The structured data must not leak the name, exact address, postcode or geo.
    const blocks = jsonLdBlocks(container);
    const serialized = JSON.stringify(blocks);
    expect(serialized).not.toContain('Bianchi');
    expect(serialized).not.toContain('King Street');
    expect(serialized).not.toContain('4WU');
    const realEstate = blocks.find((block) => block['@type'] === 'RealEstateListing');
    expect(realEstate?.['geo']).toBeUndefined();
    const address = realEstate?.['address'] as Record<string, unknown>;
    expect(address['streetAddress']).toBeUndefined();
    expect(address['postalCode']).toBeUndefined();
  });

  it('renders only town + postcode prefix (no geo JSON-LD) when hideExactAddress is set', async () => {
    findFirst.mockResolvedValue({
      ...BASE,
      id: 'p-hidden',
      listingType: 'residential',
      title: 'Edwardian semi · 4 bed',
      displayAddress: 'Palatine Road, Didsbury',
      town: 'Manchester',
      postcode: 'M20 2QR',
      latitude: 53.41,
      longitude: -2.23,
      hideExactAddress: true,
    });
    const { container } = await renderSlug('the-listing');

    // The authored headline stays; the exact address and full postcode do not render.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Edwardian semi · 4 bed');
    expect(screen.getByText('Manchester, M20')).toBeInTheDocument();
    expect(screen.queryByText(/Palatine Road/)).not.toBeInTheDocument();
    expect(screen.queryByText(/2QR/)).not.toBeInTheDocument();

    const blocks = jsonLdBlocks(container);
    const serialized = JSON.stringify(blocks);
    expect(serialized).not.toContain('Palatine Road');
    expect(serialized).not.toContain('2QR');
    const realEstate = blocks.find((block) => block['@type'] === 'RealEstateListing');
    expect(realEstate?.['geo']).toBeUndefined();
    const address = realEstate?.['address'] as Record<string, unknown>;
    expect(address['streetAddress']).toBeUndefined();
    expect(address['postalCode']).toBeUndefined();
    expect(address['addressLocality']).toBe('Manchester');
  });
});
