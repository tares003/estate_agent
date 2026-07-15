// responsive-coverage: opt-out all — asserts the customer-session gate, the
// saved-property list composition and the empty state; the responsive card grid is
// covered by the account-routes Playwright pass (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../lib/tenant.js', () => ({ getCurrentTenantId: async () => 'tenant-1' }));
vi.mock('../../lib/db.js', () => ({ getDb: () => ({}) }));

const getCustomerSession = vi.fn();
vi.mock('../../lib/customer-session.js', () => ({ getCustomerSession }));

const savedFindMany = vi.fn();
const propertyFindMany = vi.fn();
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
    fn({
      savedProperty: { findMany: savedFindMany },
      property: { findMany: propertyFindMany },
    }),
}));

const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
vi.mock('next/navigation', () => ({ redirect }));

// The client save/remove toggle is exercised in its own test; stub it here so this
// page test asserts the WIRING (which property, and its pre-marked saved state)
// without pulling in the client-only hooks.
vi.mock('./SavePropertyButton.js', () => ({
  SavePropertyButton: ({
    propertyId,
    signedIn,
    initialSaved,
  }: {
    propertyId: string;
    signedIn: boolean;
    initialSaved: boolean;
  }) => (
    <button
      data-testid="save-toggle"
      data-property-id={propertyId}
      data-signed-in={String(signedIn)}
      data-initial-saved={String(initialSaved)}
    >
      Saved
    </button>
  ),
}));

const { default: SavedPropertiesPage } = await import('./page.js');

const savedRow = {
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

beforeEach(() => {
  vi.clearAllMocks();
  getCustomerSession.mockResolvedValue({ userId: 'c1', emailVerified: true, actor: 'customer:c1' });
  savedFindMany.mockResolvedValue([{ propertyId: 'p1' }]);
  propertyFindMany.mockResolvedValue([savedRow]);
});

describe('SavedPropertiesPage', () => {
  it('redirects a signed-out visitor to sign-in with ?next preserved', async () => {
    getCustomerSession.mockResolvedValue(null);
    await expect(SavedPropertiesPage()).rejects.toThrow(
      'NEXT_REDIRECT:/sign-in?next=%2Faccount%2Fsaved',
    );
    expect(redirect).toHaveBeenCalledWith('/sign-in?next=%2Faccount%2Fsaved');
    expect(savedFindMany).not.toHaveBeenCalled();
  });

  it('lists the customer saved properties, each linking to its detail page', async () => {
    render(await SavedPropertiesPage());

    expect(screen.getByRole('heading', { level: 1, name: 'Saved properties' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edwardian semi · 4 bed' })).toHaveAttribute(
      'href',
      '/properties/palatine-road-m20',
    );
    expect(screen.getByText('£525,000')).toBeInTheDocument();
    // the saved read is scoped to the signed-in customer's own rows
    expect(savedFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'c1' } }),
    );
  });

  it('wires a remove control for each saved property, pre-marked as saved', async () => {
    render(await SavedPropertiesPage());

    const toggle = screen.getByTestId('save-toggle');
    expect(toggle).toHaveAttribute('data-property-id', 'p1');
    expect(toggle).toHaveAttribute('data-initial-saved', 'true');
    expect(toggle).toHaveAttribute('data-signed-in', 'true');
  });

  it('shows a friendly empty state when nothing is saved', async () => {
    savedFindMany.mockResolvedValue([]);

    render(await SavedPropertiesPage());

    // no saved rows → the catalogue join is never asked
    expect(propertyFindMany).not.toHaveBeenCalled();
    expect(screen.queryByTestId('save-toggle')).toBeNull();
    expect(screen.getByRole('link', { name: /Browse properties/i })).toHaveAttribute(
      'href',
      '/properties',
    );
  });
});
