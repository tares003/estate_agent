// responsive-coverage: opt-out all — asserts the data→table composition + the
// tenant-scoped query wiring; responsive layout is the admin-routes Playwright pass.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../lib/tenant.js', () => ({ getCurrentTenantId: async () => 'tenant-1' }));
vi.mock('../../lib/db.js', () => ({ getDb: () => ({}) }));

const findMany = vi.fn();
const count = vi.fn();
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
    fn({ enquiry: { findMany, count } }),
}));

const { default: EnquiryQueuePage } = await import('./page.js');

const row = {
  id: 'e1',
  name: 'Sam Buyer',
  email: 'sam@example.com',
  status: 'new',
  propertyId: null,
  createdAt: new Date('2026-06-09T12:00:00.000Z'),
  updatedAt: new Date('2026-06-09T12:00:00.000Z'),
};

function params(p: Record<string, string>) {
  return { searchParams: Promise.resolve(p) };
}

beforeEach(() => {
  vi.clearAllMocks();
  findMany.mockResolvedValue([row]);
  count.mockResolvedValue(1);
});

describe('EnquiryQueuePage', () => {
  it('renders the queue heading + a row from the tenant-scoped read', async () => {
    render(await EnquiryQueuePage(params({})));

    expect(screen.getByRole('heading', { level: 1, name: 'Enquiries' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sam Buyer' })).toHaveAttribute(
      'href',
      '/admin/enquiries/e1',
    );
    // default open-work view hides archived
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: { not: 'archived' } } }),
    );
  });

  it('passes the parsed status filter through to the query', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    render(await EnquiryQueuePage(params({ status: 'lost' })));

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: 'lost' } }));
    expect(screen.getByText('No enquiries')).toBeInTheDocument();
  });

  it('renders with no search params (the bare /admin/enquiries entry)', async () => {
    render(await EnquiryQueuePage({}));
    expect(screen.getByRole('heading', { level: 1, name: 'Enquiries' })).toBeInTheDocument();
  });
});
