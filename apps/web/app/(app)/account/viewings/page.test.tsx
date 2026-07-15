// responsive-coverage: opt-out all — asserts the chronological viewing-request list
// (status badge + property link), the empty state, the unverified-email fallback and
// the signed-out redirect; the responsive layout is covered by the account-routes
// Playwright pass (design-requirements §3), not this component test.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

vi.mock('../../lib/tenant.js', () => ({ getCurrentTenantId: async () => 'tenant-1' }));
vi.mock('../../lib/db.js', () => ({ getDb: () => ({}) }));

const getCustomerSession = vi.fn();
vi.mock('../../lib/customer-session.js', () => ({ getCustomerSession }));

const userFindFirst = vi.fn();
const enquiryFindMany = vi.fn();
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
    fn({
      user: { findFirst: userFindFirst },
      enquiry: { findMany: enquiryFindMany },
    }),
}));

const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
vi.mock('next/navigation', () => ({ redirect }));

const { default: ViewingsHistoryPage } = await import('./page.js');

beforeEach(() => {
  vi.clearAllMocks();
  getCustomerSession.mockResolvedValue({ userId: 'c1', emailVerified: true, actor: 'customer:c1' });
  userFindFirst.mockResolvedValue({ email: 'ada@example.invalid' });
  enquiryFindMany.mockResolvedValue([
    {
      id: 'v2',
      status: 'viewing_booked',
      createdAt: new Date('2026-06-02T09:00:00Z'),
      property: {
        title: '2-bed flat, Didsbury',
        slug: 'two-bed-flat-didsbury',
        displayAddress: '1 Elm Road, Didsbury',
      },
    },
    {
      id: 'v1',
      status: 'new',
      createdAt: new Date('2026-06-01T09:00:00Z'),
      property: { title: null, slug: 'studio-central', displayAddress: '9 Oak Street, Central' },
    },
  ]);
});

describe('ViewingsHistoryPage', () => {
  it('lists the customer viewing requests newest-first, each with a status and a property link', async () => {
    render(await ViewingsHistoryPage());

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);

    // Newest first: the booked viewing sits above the new one.
    expect(within(items[0]!).getByRole('link', { name: /2-bed flat, Didsbury/ })).toHaveAttribute(
      'href',
      '/properties/two-bed-flat-didsbury',
    );
    expect(within(items[0]!).getByText('Viewing booked')).toBeInTheDocument();

    expect(within(items[1]!).getByRole('link', { name: /9 Oak Street, Central/ })).toHaveAttribute(
      'href',
      '/properties/studio-central',
    );
    expect(within(items[1]!).getByText('New')).toBeInTheDocument();
  });

  it('renders a removed property as plain text (no link) while still showing its status', async () => {
    enquiryFindMany.mockResolvedValue([
      { id: 'v1', status: 'new', createdAt: new Date('2026-06-01T09:00:00Z'), property: null },
    ]);

    render(await ViewingsHistoryPage());

    const item = screen.getByRole('listitem');
    expect(within(item).queryByRole('link')).toBeNull();
    expect(within(item).getByText('Property no longer available')).toBeInTheDocument();
    expect(within(item).getByText('New')).toBeInTheDocument();
  });

  it('shows a friendly empty state with a browse CTA when there are no viewing requests', async () => {
    enquiryFindMany.mockResolvedValue([]);

    render(await ViewingsHistoryPage());

    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(screen.getByText(/requested any viewings/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Browse properties/i })).toHaveAttribute(
      'href',
      '/properties',
    );
  });

  it('shows the empty state without reading viewings when the account email is not verified', async () => {
    userFindFirst.mockResolvedValue(null);

    render(await ViewingsHistoryPage());

    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(enquiryFindMany).not.toHaveBeenCalled();
  });

  it('redirects a signed-out visitor to sign-in with ?next preserved', async () => {
    getCustomerSession.mockResolvedValue(null);

    await expect(ViewingsHistoryPage()).rejects.toThrow(
      'NEXT_REDIRECT:/sign-in?next=%2Faccount%2Fviewings',
    );
    expect(redirect).toHaveBeenCalledWith('/sign-in?next=%2Faccount%2Fviewings');
  });
});
