// responsive-coverage: opt-out all — asserts the rename / cadence / delete
// behaviour; the row's layout is covered by the account-routes Playwright pass
// (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const renameSavedSearch = vi.fn();
const updateSavedSearchFrequency = vi.fn();
const deleteSavedSearch = vi.fn();
vi.mock('./actions.js', () => ({
  renameSavedSearch: (...args: unknown[]) => renameSavedSearch(...args),
  updateSavedSearchFrequency: (...args: unknown[]) => updateSavedSearchFrequency(...args),
  deleteSavedSearch: (...args: unknown[]) => deleteSavedSearch(...args),
}));

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const { SavedSearchRow } = await import('./SavedSearchRow.js');

function row() {
  return render(
    <SavedSearchRow
      id="s1"
      name="Two-bed flats"
      alertFrequency="off"
      criteriaSummary="In Didsbury · 2+ beds"
      runHref="/properties?location=Didsbury"
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  renameSavedSearch.mockResolvedValue({ ok: true });
  updateSavedSearchFrequency.mockResolvedValue({ ok: true });
  deleteSavedSearch.mockResolvedValue({ ok: true });
});

describe('SavedSearchRow', () => {
  it('shows the name, criteria summary and run-search link', () => {
    row();
    expect(screen.getByRole('heading', { name: 'Two-bed flats' })).toBeTruthy();
    expect(screen.getByText('In Didsbury · 2+ beds')).toBeTruthy();
    expect(screen.getByRole('link', { name: /run search now/i }).getAttribute('href')).toBe(
      '/properties?location=Didsbury',
    );
  });

  it('submits a cadence change carrying the search id', async () => {
    const user = userEvent.setup();
    row();
    await user.selectOptions(screen.getByLabelText(/email alerts/i), 'weekly');
    await user.click(screen.getByRole('button', { name: /update alerts/i }));

    await waitFor(() => expect(updateSavedSearchFrequency).toHaveBeenCalledTimes(1));
    const fd = updateSavedSearchFrequency.mock.calls[0]?.[1] as FormData;
    expect(fd.get('id')).toBe('s1');
    expect(fd.get('alertFrequency')).toBe('weekly');
  });

  it('reveals a rename field and submits the new name', async () => {
    const user = userEvent.setup();
    row();
    await user.click(screen.getByRole('button', { name: /^rename$/i }));
    const field = screen.getByLabelText(/search name/i);
    await user.clear(field);
    await user.type(field, 'Renamed');
    await user.click(screen.getByRole('button', { name: /save name/i }));

    await waitFor(() => expect(renameSavedSearch).toHaveBeenCalledTimes(1));
    const fd = renameSavedSearch.mock.calls[0]?.[1] as FormData;
    expect(fd.get('id')).toBe('s1');
    expect(fd.get('name')).toBe('Renamed');
  });

  it('confirms before deleting and submits the delete', async () => {
    const user = userEvent.setup();
    row();
    await user.click(screen.getByRole('button', { name: /delete saved search two-bed flats/i }));
    // The confirmation modal is now open.
    await user.click(screen.getByRole('button', { name: /delete search/i }));

    await waitFor(() => expect(deleteSavedSearch).toHaveBeenCalledTimes(1));
    const fd = deleteSavedSearch.mock.calls[0]?.[1] as FormData;
    expect(fd.get('id')).toBe('s1');
  });
});
