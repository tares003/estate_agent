// responsive-coverage: opt-out all — asserts the toggle behaviour + signed-out
// link; the heart's layout is covered by the public-routes Playwright pass
// (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const toggleSavedProperty = vi.fn();
vi.mock('./actions.js', () => ({
  toggleSavedProperty: (...args: unknown[]) => toggleSavedProperty(...args),
}));

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const { SavePropertyButton } = await import('./SavePropertyButton.js');

beforeEach(() => {
  vi.clearAllMocks();
  toggleSavedProperty.mockResolvedValue({ ok: true, saved: true });
});

describe('SavePropertyButton', () => {
  it('renders a sign-in link carrying the current path when signed out', () => {
    render(
      <SavePropertyButton
        propertyId="p1"
        signedIn={false}
        initialSaved={false}
        currentPath="/properties/one"
      />,
    );
    const link = screen.getByRole('link', { name: /save/i });
    expect(link.getAttribute('href')).toBe('/sign-in?next=%2Fproperties%2Fone');
  });

  it('renders a pressed toggle reflecting the initial saved state when signed in', () => {
    render(<SavePropertyButton propertyId="p1" signedIn initialSaved />);
    expect(screen.getByRole('button', { name: /remove/i }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('toggles optimistically and submits the property id on click', async () => {
    const user = userEvent.setup();
    render(<SavePropertyButton propertyId="p1" signedIn initialSaved={false} />);

    const button = screen.getByRole('button', { name: /save/i });
    await user.click(button);

    // Optimistic flip is immediate.
    expect(screen.getByRole('button', { name: /remove/i }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(toggleSavedProperty).toHaveBeenCalledTimes(1);
    const fd = toggleSavedProperty.mock.calls[0]?.[1] as FormData;
    expect(fd.get('propertyId')).toBe('p1');
  });

  it('reverts the optimistic state when the action fails', async () => {
    toggleSavedProperty.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<SavePropertyButton propertyId="p1" signedIn initialSaved={false} />);

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /save/i }).getAttribute('aria-pressed')).toBe(
        'false',
      ),
    );
  });
});
