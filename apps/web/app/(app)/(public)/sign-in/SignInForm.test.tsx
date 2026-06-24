// responsive-coverage: opt-out all — asserts the sign-in form's fields, their
// autocomplete hints, the forgot-password / create-account helper links and the
// error branch; the centred single-column layout is covered by the
// account-routes Playwright pass (design-briefs/v1/EPIC-T §Authentication forms,
// design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const submitSignIn = vi.fn();
vi.mock('./actions.js', () => ({
  submitSignIn: (...args: unknown[]) => submitSignIn(...args),
}));

const { SignInForm } = await import('./SignInForm.js');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SignInForm', () => {
  it('renders the email and password fields with sign-in autocomplete hints (a11y)', () => {
    render(<SignInForm />);
    const email = screen.getByRole('textbox', { name: /^email/i });
    expect(email).toHaveAttribute('autocomplete', 'email');
    // A password input has no implicit ARIA role — query it by id.
    const password = document.getElementById('password');
    expect(password).toHaveAttribute('type', 'password');
    // Sign-in uses `current-password` (NOT `new-password` — that is registration).
    expect(password).toHaveAttribute('autocomplete', 'current-password');
  });

  it('does NOT render a GDPR consent checkbox (sign-in captures no new personal data)', () => {
    render(<SignInForm />);
    expect(screen.queryByRole('checkbox', { name: /agree|consent/i })).toBeNull();
  });

  it('offers a forgot-password and a create-account link', () => {
    render(<SignInForm />);
    expect(screen.getByRole('link', { name: /forgot.*password/i })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
    expect(screen.getByRole('link', { name: /create.*account|register|sign up/i })).toHaveAttribute(
      'href',
      '/register',
    );
  });

  it('carries the next destination through as a hidden field so the action can honour it', () => {
    render(<SignInForm next="/account/saved" />);
    const hidden = document.querySelector('input[name="next"]');
    expect(hidden).not.toBeNull();
    expect(hidden).toHaveAttribute('value', '/account/saved');
  });

  it('shows a generic error summary when authentication fails', () => {
    render(<SignInForm initialState={{ ok: false, errors: [{ message: 'Email or password is incorrect.' }] }} />);
    expect(screen.getByText(/email or password is incorrect/i)).toBeInTheDocument();
  });
});
