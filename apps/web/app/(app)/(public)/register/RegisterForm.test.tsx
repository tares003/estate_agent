// responsive-coverage: opt-out all — asserts the register form's fields, the
// mandatory GDPR consent affirmation, and the success state; the centred
// single-column layout is covered by the account-routes Playwright pass
// (design-briefs/v1/EPIC-T §Authentication forms, design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const submitRegister = vi.fn();
vi.mock('./actions.js', () => ({
  submitRegister: (...args: unknown[]) => submitRegister(...args),
}));

const { RegisterForm } = await import('./RegisterForm.js');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RegisterForm', () => {
  it('renders the name, email and password fields with autocomplete hints (a11y)', () => {
    render(<RegisterForm />);
    expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
    const email = screen.getByLabelText(/^email/i);
    expect(email).toHaveAttribute('autocomplete', 'email');
    const password = screen.getByLabelText(/^password/i);
    expect(password).toHaveAttribute('type', 'password');
    expect(password).toHaveAttribute('autocomplete', 'new-password');
  });

  it('renders the mandatory GDPR consent affirmation as a required checkbox (G5)', () => {
    render(<RegisterForm />);
    const consent = screen.getByRole('checkbox', { name: /agree/i });
    expect(consent).toBeRequired();
    expect(consent).toHaveAttribute('name', 'gdpr_consent');
  });

  it('renders an optional marketing opt-in checkbox distinct from the consent', () => {
    render(<RegisterForm />);
    const marketing = screen.getByRole('checkbox', { name: /marketing|updates|offers/i });
    expect(marketing).not.toBeRequired();
    expect(marketing).toHaveAttribute('name', 'marketingOptIn');
  });

  it('shows a verify-your-email confirmation when registration succeeds', () => {
    submitRegister.mockReturnValue({ ok: true });
    vi.stubGlobal('useActionState', undefined);
    render(<RegisterForm initialState={{ ok: true }} />);
    expect(screen.getByText(/check your (email|inbox)|verify your email/i)).toBeInTheDocument();
  });
});
