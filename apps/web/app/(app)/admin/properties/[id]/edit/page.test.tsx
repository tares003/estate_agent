// responsive-coverage: opt-out all — asserts the edit-page shell + the RBAC gate +
// the tenant-scoped read + the not-found path; the form behaviour is in
// PropertyForm.test.tsx and layout is the admin-routes Playwright pass.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../../lib/tenant.js', () => ({ getCurrentTenantId: async () => 'tenant-1' }));
vi.mock('../../../../lib/db.js', () => ({ getDb: () => ({}) }));

const requireStaffPermission = vi.fn();
vi.mock('../../../../lib/staff-session.js', () => ({
  requireStaffPermission: (...args: unknown[]) => requireStaffPermission(...args),
}));

// FR-F-3 — the page resolves the tenant's authorable verticals to gate the vertical
// form; stub it so this shell test stays DB/request-free.
vi.mock('../../../../lib/packs.js', () => ({ getEnabledVerticals: vi.fn(async () => []) }));

const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', () => ({ notFound: () => notFound() }));

vi.mock('../../actions.js', () => ({ updateProperty: vi.fn() }));
vi.mock('../../PropertyForm.js', () => ({
  PropertyForm: ({ mode, initial }: { mode: string; initial?: { id: string } }) => (
    <div data-testid="property-form">{`${mode}:${initial?.id ?? ''}`}</div>
  ),
}));

const findFirst = vi.fn();
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
    fn({ property: { findFirst } }),
}));

const { default: EditPropertyPage } = await import('./page.js');

function props(id: string) {
  return { params: Promise.resolve({ id }) };
}

const row = {
  id: '33333333-3333-3333-3333-333333333333',
  reference: 'REF-001',
  listingType: 'residential',
  saleType: 'sale',
  slug: 'flat-chorlton',
  title: 'Charming flat',
  price: 35_000_000,
  priceQualifier: 'guide_price',
  marketStatus: 'for_sale',
  bedrooms: 2,
  bathrooms: 1,
  category: 'flat',
  tenure: 'leasehold',
  councilTaxBand: 'b',
  epcRating: 'c',
  displayAddress: '12 Acacia Avenue',
  postcode: 'M21 9WN',
  town: 'Chorlton',
  description: 'A flat.',
  keyFeatures: ['Two beds'],
  metaTitle: null,
  metaDescription: null,
  publicationStatus: 'draft',
};

beforeEach(() => {
  vi.clearAllMocks();
  requireStaffPermission.mockResolvedValue(undefined);
  findFirst.mockResolvedValue(row);
});

describe('EditPropertyPage', () => {
  it('gates on property.write, reads the listing tenant-scoped, and pre-fills the form', async () => {
    render(await EditPropertyPage(props('33333333-3333-3333-3333-333333333333')));

    expect(requireStaffPermission).toHaveBeenCalledWith('property.write');
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: '33333333-3333-3333-3333-333333333333', deletedAt: null },
    });
    expect(screen.getByRole('heading', { level: 1, name: 'Edit property' })).toBeInTheDocument();
    expect(screen.getByTestId('property-form')).toHaveTextContent(
      'edit:33333333-3333-3333-3333-333333333333',
    );
  });

  it('404s when the listing is unknown within the tenant', async () => {
    findFirst.mockResolvedValue(null);
    await expect(EditPropertyPage(props('44444444-4444-4444-4444-444444444444'))).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
    expect(notFound).toHaveBeenCalled();
  });

  // A `[id]` segment that is not a uuid can never name a row, and handing it to a uuid
  // column throws P2023 — an unhandled 500 — rather than returning nothing. Every one of
  // these routes did exactly that (verified live: /admin/.../not-a-uuid returned 500).
  // It must 404, and it must not reach the database to find that out.
  it('renders 404 for a malformed id, without querying the database', async () => {
    await expect(EditPropertyPage(props('not-a-uuid'))).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
    expect(findFirst).not.toHaveBeenCalled();
  });
});
