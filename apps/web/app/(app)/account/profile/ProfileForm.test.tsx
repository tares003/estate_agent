// responsive-coverage: opt-out all — asserts the prefill / submit / success
// behaviour of the profile form; the form's layout is covered by the account-
// routes Playwright pass (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const updateProfile = vi.fn();
vi.mock('./actions.js', () => ({
  updateProfile: (...args: unknown[]) => updateProfile(...args),
}));

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const { ProfileForm } = await import('./ProfileForm.js');

function profile(overrides: Partial<Parameters<typeof ProfileForm>[0]> = {}) {
  return render(
    <ProfileForm
      name="Albert Aardvark"
      phone="07911 123456"
      contactByEmail
      contactBySms={false}
      marketingOptIn={false}
      {...overrides}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  updateProfile.mockResolvedValue({ ok: true });
});

describe('ProfileForm (FR-T-11)', () => {
  it('prefills the name, phone and preference toggles from the current profile', () => {
    profile();
    expect((screen.getByLabelText(/full name/i) as HTMLInputElement).value).toBe('Albert Aardvark');
    expect((screen.getByLabelText(/phone number/i) as HTMLInputElement).value).toBe('07911 123456');
    expect((screen.getByLabelText(/contact me by email/i) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText(/contact me by sms/i) as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText(/marketing/i) as HTMLInputElement).checked).toBe(false);
  });

  it('does NOT render a GDPR-consent affirmation (self-service edit, not lead capture)', () => {
    profile();
    expect(screen.queryByLabelText(/consent/i)).toBeNull();
  });

  it('submits the edited name, phone and preferences to the action', async () => {
    const user = userEvent.setup();
    profile({ phone: null, contactByEmail: false });
    const name = screen.getByLabelText(/full name/i);
    await user.clear(name);
    await user.type(name, 'Beatrix Badger');
    await user.type(screen.getByLabelText(/phone number/i), '07900 111222');
    await user.click(screen.getByLabelText(/contact me by email/i));
    await user.click(screen.getByLabelText(/marketing/i));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(updateProfile).toHaveBeenCalledTimes(1));
    const fd = updateProfile.mock.calls[0]?.[1] as FormData;
    expect(fd.get('name')).toBe('Beatrix Badger');
    expect(fd.get('phone')).toBe('07900 111222');
    expect(fd.get('contactByEmail')).toBe('on');
    expect(fd.get('marketingOptIn')).toBe('on');
  });

  it('shows an inline confirmation and refreshes after a successful save', async () => {
    const user = userEvent.setup();
    profile();
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(screen.getByText(/profile updated/i)).toBeTruthy());
    expect(refresh).toHaveBeenCalled();
  });

  it('surfaces a server error and does not show the confirmation', async () => {
    updateProfile.mockResolvedValue({ ok: false, errors: [{ message: 'Something went wrong.' }] });
    const user = userEvent.setup();
    profile();
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(screen.getByText(/something went wrong/i)).toBeTruthy());
    expect(screen.queryByText(/profile updated/i)).toBeNull();
  });
});
