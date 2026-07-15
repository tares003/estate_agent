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
    expect(screen.getByRole('textbox', { name: /your name/i })).toBeInTheDocument();
    // The marketing checkbox label also starts with "Email", so target the
    // textbox role to disambiguate from the checkbox.
    const email = screen.getByRole('textbox', { name: /^email/i });
    expect(email).toHaveAttribute('autocomplete', 'email');
    // A password input has no implicit ARIA role, so query it by name + id.
    const password = document.getElementById('password');
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

  // Regression: a validation error used to wipe the whole form. The form now
  // pre-fills the safe fields (name/email) from the returned state, but the
  // password must NEVER be pre-filled (a lost password on error is correct) and
  // consent must NEVER be pre-checked (G5 — re-affirming it is the point).
  it('pre-fills name and email from state after an error, but never the password and never pre-checks consent', () => {
    render(
      <RegisterForm
        initialState={{
          ok: false,
          errors: [{ field: 'password', message: 'Use at least 12 characters.' }],
          values: { name: 'Penny Pomeroy', email: 'penny@example.invalid' },
        }}
      />,
    );

    expect(screen.getByRole('textbox', { name: /your name/i })).toHaveValue('Penny Pomeroy');
    expect(screen.getByRole('textbox', { name: /^email/i })).toHaveValue('penny@example.invalid');
    // SECURITY — the password input must start empty; it is never echoed back.
    const password = document.getElementById('password');
    expect(password).toHaveValue('');
    // G5 / GDPR — consent must NOT be pre-checked.
    expect(screen.getByRole('checkbox', { name: /agree/i })).not.toBeChecked();
  });
});
