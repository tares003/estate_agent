// responsive-coverage: opt-out all — block composition test; responsive layout is
// the design-canvas / page-level e2e concern (design-requirements §3).
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock the modules PropertyGridBlock dynamically imports at render, so the async
// fetch->map->render path is exercised without a real DB. searchProperties is the
// REAL function running over the fake tx (so the options mapping + card mapping
// are genuinely exercised end-to-end).
const findMany = vi.fn();
const count = vi.fn();
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
    fn({ property: { findMany, count } }),
}));
vi.mock('../../app/(app)/lib/db.js', () => ({ getDb: () => ({}) }));
vi.mock('../../app/(app)/lib/tenant.js', () => ({ getCurrentTenantId: async () => 'tenant-1' }));
vi.mock('@estate/ui', () => ({
  PropertyCard: ({ href, title }: { href: string; title: string }) => <a href={href}>{title}</a>,
}));

const { PropertyGridBlock } = await import('./PropertyGridBlock.js');

const row = {
  id: '1',
  slug: 'canalside-m15',
  displayAddress: 'Ellesmere Street',
  postcode: 'M15',
  title: 'Canalside apartment',
  saleType: 'rent',
  marketStatus: 'to_let',
  price: 145000,
  bedrooms: 2,
  bathrooms: 1,
  receptions: 1,
};

describe('PropertyGridBlock', () => {
  it('fetches tenant-scoped properties matching the config and renders them as cards', async () => {
    findMany.mockResolvedValue([row]);
    count.mockResolvedValue(1);

    const ui = await PropertyGridBlock({
      data: { heading: 'Featured', saleType: 'rent', limit: 3 },
    });
    render(ui);

    expect(screen.getByRole('heading', { name: 'Featured' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Canalside apartment' })).toBeInTheDocument();
    // the config -> options mapping reached the query: saleType filter + limit -> take
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ saleType: 'rent' }), take: 3 }),
    );
  });

  it('renders nothing when there are no matching properties (graceful empty)', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
    const ui = await PropertyGridBlock({ data: {} });
    expect(ui).toBeNull();
  });
});
