// responsive-coverage: opt-out all — asserts the reset-password form's new-password
// field, the hidden token carry-through, and the success state; the centred
// single-column layout is covered by the auth-routes Playwright pass
// (design-briefs/v1/EPIC-N §Login / register / password-reset screens).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const submitResetPassword = vi.fn();
vi.mock('./actions.js', () => ({
  submitResetPassword: (...args: unknown[]) => submitResetPassword(...args),
}));

const { ResetPasswordForm } = await import('./ResetPasswordForm.js');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ResetPasswordForm', () => {
  it('renders a new-password field with the new-password autocomplete hint (a11y)', () => {
    render(<ResetPasswordForm token="tok123" />);
    const password = document.getElementById('password');
    expect(password).toHaveAttribute('type', 'password');
    expect(password).toHaveAttribute('autocomplete', 'new-password');
  });

  it('carries the reset token through as a hidden field', () => {
    render(<ResetPasswordForm token="tok123" />);
    const hidden = document.querySelector('input[name="token"]');
    expect(hidden).toHaveAttribute('type', 'hidden');
    expect(hidden).toHaveAttribute('value', 'tok123');
  });

  it('shows a success confirmation with a sign-in link when the reset succeeds', () => {
    render(<ResetPasswordForm token="tok123" initialState={{ ok: true }} />);
    expect(screen.getByText(/password (has been )?(updated|reset|changed)|you can now sign in/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
  });
});
