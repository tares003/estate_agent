// responsive-coverage: opt-out all — asserts the create-page shell + the RBAC gate;
// the form behaviour is in PropertyForm.test.tsx and layout is the admin-routes
// Playwright pass (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const requireStaffPermission = vi.fn();
vi.mock('../../../lib/staff-session.js', () => ({
  requireStaffPermission: (...args: unknown[]) => requireStaffPermission(...args),
}));

// FR-F-3 — the page resolves the tenant's authorable verticals to gate the vertical
// form; stub it so the page test stays DB/request-free.
vi.mock('../../../lib/packs.js', () => ({ getEnabledVerticals: vi.fn(async () => []) }));

// The action + the client form are exercised elsewhere; stub the form to its mode.
vi.mock('../actions.js', () => ({ createProperty: vi.fn() }));
vi.mock('../PropertyForm.js', () => ({
  PropertyForm: ({ mode }: { mode: string }) => <div data-testid="property-form">{mode}</div>,
}));

const { default: NewPropertyPage } = await import('./page.js');

beforeEach(() => {
  vi.clearAllMocks();
  requireStaffPermission.mockResolvedValue(undefined);
});

describe('NewPropertyPage', () => {
  it('gates on property.write before rendering the create form (fail-closed)', async () => {
    render(await NewPropertyPage());
    expect(requireStaffPermission).toHaveBeenCalledWith('property.write');
  });

  it('renders the heading and the form in create mode', async () => {
    render(await NewPropertyPage());
    expect(screen.getByRole('heading', { level: 1, name: 'New property' })).toBeInTheDocument();
    expect(screen.getByTestId('property-form')).toHaveTextContent('create');
  });

  it('propagates the RBAC rejection (does not render for an unauthorised user)', async () => {
    requireStaffPermission.mockRejectedValue(new Error('forbidden'));
    await expect(NewPropertyPage()).rejects.toThrow('forbidden');
  });
});
