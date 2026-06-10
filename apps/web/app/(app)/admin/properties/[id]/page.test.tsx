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

// The edit form is a client component (useActionState/useRouter); stub it so the
// RSC page test focuses on the header + the tenant-scoped read.
vi.mock('./PropertyEditForm.js', () => ({
  PropertyEditForm: ({ property }: { property: { id: string } }) => (
    <div data-testid="property-edit-form">{property.id}</div>
  ),
}));
vi.mock('./PublishControl.js', () => ({
  PublishControl: ({ published }: { published: boolean }) => (
    <div data-testid="publish-control">{published ? 'published' : 'draft'}</div>
  ),
}));
vi.mock('./MarketStatusControl.js', () => ({
  MarketStatusControl: ({ current, options }: { current: string; options: string[] }) => (
    <div data-testid="market-status-control">{`${current}:${options.join(',')}`}</div>
  ),
}));

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
  it('renders the header context + the edit form for the fetched listing', async () => {
    render(await AdminPropertyDetailPage(props()));

    expect(
      screen.getByRole('heading', { level: 1, name: 'Palatine Road, Didsbury' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('For sale · For sale')).toBeInTheDocument(); // saleType · marketStatus
    expect(screen.getByTestId('property-edit-form')).toHaveTextContent('p1');
    expect(screen.getByTestId('publish-control')).toHaveTextContent('draft');
    // the market-status control gets the current status + the sale-type's options
    expect(screen.getByTestId('market-status-control')).toHaveTextContent(
      'for_sale:for_sale,under_offer,sold_stc,sold,withdrawn',
    );
    // admin read is by id, drafts included (no published filter)
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'p1', deletedAt: null } });
  });

  it('frames a published rental in the header', async () => {
    findFirst.mockResolvedValue({
      ...property,
      saleType: 'rent',
      marketStatus: 'to_let',
      publishedAt: new Date('2026-06-01T00:00:00.000Z'),
    });
    render(await AdminPropertyDetailPage(props()));
    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.getByText('To rent · To let')).toBeInTheDocument();
    expect(screen.getByTestId('publish-control')).toHaveTextContent('published');
  });

  it('404s an unknown listing', async () => {
    findFirst.mockResolvedValue(null);
    await expect(AdminPropertyDetailPage(props('nope'))).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
