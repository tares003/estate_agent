// responsive-coverage: opt-out all — asserts the data→table composition + the
// tenant-scoped query wiring; responsive layout is the admin-routes Playwright pass.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../lib/tenant.js', () => ({ getCurrentTenantId: async () => 'tenant-1' }));
vi.mock('../../lib/db.js', () => ({ getDb: () => ({}) }));

const requireStaffPermission = vi.fn();
vi.mock('../../lib/staff-session.js', () => ({
  requireStaffPermission: (...args: unknown[]) => requireStaffPermission(...args),
}));

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
  requireStaffPermission.mockResolvedValue(undefined);
  findMany.mockResolvedValue([row]);
  count.mockResolvedValue(1);
});

describe('EnquiryQueuePage', () => {
  // Audit finding admin-read-pages-ungated-pii-leak: the enquiry queue renders
  // names/emails/messages — RBAC-gated fail-closed, mirroring feedback/page.tsx.
  it('gates on the enquiry.read permission before reading', async () => {
    render(await EnquiryQueuePage(params({})));
    expect(requireStaffPermission).toHaveBeenCalledWith('enquiry.read');
  });

  it('propagates a denial WITHOUT reading the queue (fail-closed)', async () => {
    requireStaffPermission.mockRejectedValueOnce(new Error('denied'));
    await expect(EnquiryQueuePage(params({}))).rejects.toThrow('denied');
    expect(findMany).not.toHaveBeenCalled();
  });

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
