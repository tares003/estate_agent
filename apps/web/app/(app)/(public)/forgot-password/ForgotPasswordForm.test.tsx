// responsive-coverage: opt-out all — asserts the forgot-password form's email
// field, the mandatory GDPR consent affirmation (G5) and the neutral success
// state; the centred single-column layout is covered by the auth-routes Playwright
// pass (design-briefs/v1/EPIC-N §Login / register / password-reset screens).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const submitForgotPassword = vi.fn();
vi.mock('./actions.js', () => ({
  submitForgotPassword: (...args: unknown[]) => submitForgotPassword(...args),
}));

const { ForgotPasswordForm } = await import('./ForgotPasswordForm.js');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ForgotPasswordForm', () => {
  it('renders the email field with an autocomplete hint (a11y)', () => {
    render(<ForgotPasswordForm />);
    const email = screen.getByRole('textbox', { name: /email/i });
    expect(email).toHaveAttribute('autocomplete', 'email');
    expect(email).toHaveAttribute('name', 'email');
  });

  it('renders the mandatory GDPR consent affirmation as a required checkbox (G5)', () => {
    render(<ForgotPasswordForm />);
    const consent = screen.getByRole('checkbox', { name: /agree|consent/i });
    expect(consent).toBeRequired();
    expect(consent).toHaveAttribute('name', 'gdpr_consent');
  });

  it('shows a neutral check-your-email confirmation when the request succeeds', () => {
    render(<ForgotPasswordForm initialState={{ ok: true }} />);
    expect(screen.getByText(/check your (email|inbox)|if .*account.*exists|sent/i)).toBeInTheDocument();
  });
});
