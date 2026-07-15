// responsive-coverage: opt-out all — asserts the form composition + success/error
// states; the responsive layout is the page-level Playwright e2e pass
// (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { VALUATION_CONSENT_TEXT } from './consent-text.js';

const submitValuation = vi.fn();
vi.mock('./actions.js', () => ({
  submitValuation: (...args: unknown[]) => submitValuation(...args),
}));

const { ValuationForm } = await import('./ValuationForm.js');

beforeEach(() => {
  vi.clearAllMocks();
  submitValuation.mockResolvedValue({ ok: false });
});

describe('ValuationForm', () => {
  it('renders the valuation fields with the verbatim consent affirmation', () => {
    render(<ValuationForm />);
    expect(screen.getByLabelText(/Your name/i)).toBeRequired();
    expect(screen.getByLabelText(/Property address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Postcode/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Property type/i)).toBeInTheDocument();
    expect(screen.getByText(VALUATION_CONSENT_TEXT)).toBeInTheDocument();
  });

  it('shows the success confirmation after a successful submit', async () => {
    submitValuation.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<ValuationForm />);

    await user.click(screen.getByRole('button', { name: /Request valuation/i }));

    expect(await screen.findByText(/valuation request has been sent/i)).toBeInTheDocument();
    expect(submitValuation).toHaveBeenCalledTimes(1);
  });

  it('surfaces a field-linked error summary returned by the action', async () => {
    submitValuation.mockResolvedValue({
      ok: false,
      errors: [{ field: 'postcode', message: 'Enter a valid UK postcode.' }],
    });
    const user = userEvent.setup();
    render(<ValuationForm />);

    await user.click(screen.getByRole('button', { name: /Request valuation/i }));

    const link = await screen.findByRole('link', { name: /Enter a valid UK postcode/i });
    expect(link).toHaveAttribute('href', '#postcode');
  });

  // Regression: mistyping one field (a postcode) used to wipe every other field.
  // The form now pre-fills the safe fields from the returned state — but NEVER
  // pre-checks the GDPR consent (G5 — the user must re-affirm it every submit).
  it('pre-fills the safe fields from returned state after a validation error', () => {
    render(
      <ValuationForm
        initialState={{
          ok: false,
          errors: [{ field: 'postcode', message: 'Enter a valid UK postcode.' }],
          values: {
            name: 'Olive Owner',
            email: 'olive@example.com',
            phone: '07700900000',
            addressLine1: '1 Palatine Road',
            postcode: 'NOT A POSTCODE',
            propertyType: 'Terraced house',
            bedrooms: '3',
          },
        }}
      />,
    );

    expect(screen.getByLabelText(/Your name/i)).toHaveValue('Olive Owner');
    expect(screen.getByLabelText(/Email/i)).toHaveValue('olive@example.com');
    expect(screen.getByLabelText(/Phone/i)).toHaveValue('07700900000');
    expect(screen.getByLabelText(/Property address/i)).toHaveValue('1 Palatine Road');
    expect(screen.getByLabelText(/Postcode/i)).toHaveValue('NOT A POSTCODE');
    expect(screen.getByLabelText(/Property type/i)).toHaveValue('Terraced house');
    expect(screen.getByLabelText(/Bedrooms/i)).toHaveValue(3);
    // G5 / GDPR — consent must NOT be pre-checked; re-affirming it is the point.
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });
});
