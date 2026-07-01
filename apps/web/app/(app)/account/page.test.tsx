// responsive-coverage: opt-out all — asserts the greeting, the destination cards
// and their at-a-glance counts from the tenant-scoped summary read, plus the
// signed-out redirect; the responsive card grid is the account-routes Playwright
// pass (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

vi.mock('../lib/tenant.js', () => ({ getCurrentTenantId: async () => 'tenant-1' }));
vi.mock('../lib/db.js', () => ({ getDb: () => ({}) }));

const getCustomerSession = vi.fn();
vi.mock('../lib/customer-session.js', () => ({ getCustomerSession }));

const findFirst = vi.fn();
const savedPropertyCount = vi.fn();
const savedSearchCount = vi.fn();
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
    fn({
      user: { findFirst },
      savedProperty: { count: savedPropertyCount },
      savedSearch: { count: savedSearchCount },
    }),
}));

const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
vi.mock('next/navigation', () => ({ redirect }));

const { default: AccountDashboardPage } = await import('./page.js');

beforeEach(() => {
  vi.clearAllMocks();
  getCustomerSession.mockResolvedValue({
    userId: 'c1',
    emailVerified: true,
    actor: 'customer:c1',
  });
  findFirst.mockResolvedValue({ name: 'Ada Lovelace' });
  savedPropertyCount.mockResolvedValue(3);
  savedSearchCount.mockResolvedValue(2);
});

describe('AccountDashboardPage', () => {
  it('greets the customer by their first name', async () => {
    render(await AccountDashboardPage());
    expect(
      screen.getByRole('heading', { level: 1, name: 'Welcome back, Ada' }),
    ).toBeInTheDocument();
  });

  it('falls back to a neutral greeting when the name is missing', async () => {
    findFirst.mockResolvedValue(null);
    render(await AccountDashboardPage());
    expect(
      screen.getByRole('heading', { level: 1, name: 'Welcome back, there' }),
    ).toBeInTheDocument();
  });

  it('links each destination card, surfacing the saved counts where available', async () => {
    render(await AccountDashboardPage());
    const sections = within(screen.getByRole('region', { name: 'Your account sections' }));

    const saved = sections.getByRole('link', { name: /Saved properties/ });
    expect(saved).toHaveAttribute('href', '/account/saved');
    expect(
      within(saved).getByText('3 saved — Properties you have added to your favourites'),
    ).toBeInTheDocument();

    const searches = sections.getByRole('link', { name: /Saved searches/ });
    expect(searches).toHaveAttribute('href', '/account/searches');

    expect(sections.getByRole('link', { name: /Viewings/ })).toHaveAttribute(
      'href',
      '/account/viewings',
    );
    expect(sections.getByRole('link', { name: /Profile/ })).toHaveAttribute(
      'href',
      '/account/profile',
    );
  });

  it('redirects a signed-out visitor to sign-in with ?next preserved', async () => {
    getCustomerSession.mockResolvedValue(null);
    await expect(AccountDashboardPage()).rejects.toThrow('NEXT_REDIRECT:/sign-in?next=%2Faccount');
    expect(redirect).toHaveBeenCalledWith('/sign-in?next=%2Faccount');
  });
});
