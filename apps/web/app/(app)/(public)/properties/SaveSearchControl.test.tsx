// responsive-coverage: opt-out all — asserts the save affordance + form
// submission; the control's layout is covered by the public-routes Playwright pass
// (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createSavedSearch = vi.fn();
vi.mock('../../account/searches/actions.js', () => ({
  createSavedSearch: (...args: unknown[]) => createSavedSearch(...args),
}));

const { SaveSearchControl } = await import('./SaveSearchControl.js');

beforeEach(() => {
  vi.clearAllMocks();
  createSavedSearch.mockResolvedValue({ ok: true });
});

describe('SaveSearchControl', () => {
  it('renders a sign-in link carrying the current path when signed out', () => {
    render(
      <SaveSearchControl
        filtersJson="{}"
        signedIn={false}
        currentPath="/properties?location=Leeds"
      />,
    );
    const link = screen.getByRole('link', { name: /sign in to save/i });
    expect(link.getAttribute('href')).toBe('/sign-in?next=%2Fproperties%3Flocation%3DLeeds');
  });

  it('reveals the name + cadence form and submits the active filters', async () => {
    const user = userEvent.setup();
    const filtersJson = JSON.stringify({ location: 'Leeds', sort: 'newest', page: 1, unit: 'mi' });
    render(<SaveSearchControl filtersJson={filtersJson} signedIn />);

    await user.click(screen.getByRole('button', { name: /save this search/i }));
    await user.type(screen.getByLabelText(/name this search/i), 'Leeds homes');
    await user.click(screen.getByRole('button', { name: /^save search$/i }));

    await waitFor(() => expect(createSavedSearch).toHaveBeenCalledTimes(1));
    const fd = createSavedSearch.mock.calls[0]?.[1] as FormData;
    expect(fd.get('name')).toBe('Leeds homes');
    expect(fd.get('filters')).toBe(filtersJson);
  });

  it('shows a saved confirmation with a link to manage searches on success', async () => {
    const user = userEvent.setup();
    render(<SaveSearchControl filtersJson="{}" signedIn />);
    await user.click(screen.getByRole('button', { name: /save this search/i }));
    await user.type(screen.getByLabelText(/name this search/i), 'Anything');
    await user.click(screen.getByRole('button', { name: /^save search$/i }));

    await waitFor(() =>
      expect(screen.getByRole('link', { name: /manage saved searches/i })).toBeTruthy(),
    );
  });
});
