// responsive-coverage: opt-out all — asserts the admin segment's fail-closed
// session gate + the shell composition; layout is the admin-routes Playwright pass.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Audit findings admin-read-pages-ungated-pii-leak / admin-read-surfaces-missing-
// rbac-gate: the admin layout is the segment-wide authentication gate. NO staff
// session (production, unauthenticated) → redirect away; a resolved session
// renders the shell with the staff actor label. Per-page RBAC (*.read) layers on
// top in each page.

const getStaffSession = vi.fn();
vi.mock('../lib/staff-session.js', () => ({
  getStaffSession: () => getStaffSession(),
}));

vi.mock('../lib/tenant.js', () => ({ getCurrentPathname: async () => '/admin/enquiries' }));

const redirect = vi.fn((to: string) => {
  throw new Error(`NEXT_REDIRECT:${to}`);
});
vi.mock('next/navigation', () => ({ redirect: (to: string) => redirect(to) }));

vi.mock('../../../components/admin/AdminShell.js', () => ({
  AdminShell: ({
    accountLabel,
    children,
  }: {
    accountLabel: string;
    children: React.ReactNode;
  }) => (
    <div data-testid="admin-shell" data-account={accountLabel}>
      {children}
    </div>
  ),
}));

const { default: AdminLayout } = await import('./layout.js');

beforeEach(() => {
  vi.clearAllMocks();
  getStaffSession.mockResolvedValue({ userId: 'u1', role: 'super_admin', actor: 'agent:u1' });
});

describe('AdminLayout', () => {
  it('renders the shell + children with the resolved staff actor label', async () => {
    render(await AdminLayout({ children: <p>Queue</p> }));
    expect(screen.getByTestId('admin-shell')).toHaveAttribute('data-account', 'agent:u1');
    expect(screen.getByText('Queue')).toBeInTheDocument();
  });

  it('DENIES the whole /admin segment when no staff session resolves (fail-closed)', async () => {
    getStaffSession.mockResolvedValue(null);
    await expect(AdminLayout({ children: <p>Queue</p> })).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirect).toHaveBeenCalledTimes(1);
  });
});
