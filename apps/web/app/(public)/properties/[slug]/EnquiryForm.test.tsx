// responsive-coverage: opt-out all — this asserts the form's composition and its
// success/error states; the responsive layout is covered by the page-level
// Playwright e2e pass (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ENQUIRY_CONSENT_TEXT } from './consent-text.js';

const submitEnquiry = vi.fn();
vi.mock('./actions.js', () => ({
  submitEnquiry: (...args: unknown[]) => submitEnquiry(...args),
}));

const { EnquiryForm } = await import('./EnquiryForm.js');

beforeEach(() => {
  vi.clearAllMocks();
  submitEnquiry.mockResolvedValue({ ok: false });
});

describe('EnquiryForm', () => {
  it('renders the enquiry fields with the verbatim consent affirmation', () => {
    render(<EnquiryForm propertyId="prop-1" propertyTitle="Palatine Road semi" />);

    expect(
      screen.getByRole('heading', { name: /Enquire about Palatine Road semi/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Your name/i)).toBeRequired();
    expect(screen.getByLabelText(/^Email/i)).toBeInTheDocument();
    expect(screen.getByText(ENQUIRY_CONSENT_TEXT)).toBeInTheDocument();
    expect(document.querySelector('input[name="propertyId"]')).toHaveValue('prop-1');
  });

  it('shows the success confirmation after a successful submit', async () => {
    submitEnquiry.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<EnquiryForm propertyId="prop-1" propertyTitle="Palatine Road semi" />);

    await user.click(screen.getByRole('button', { name: /Send enquiry/i }));

    expect(await screen.findByText(/Your enquiry has been sent/i)).toBeInTheDocument();
    expect(submitEnquiry).toHaveBeenCalledTimes(1);
  });

  it('surfaces a field-linked error summary returned by the action', async () => {
    submitEnquiry.mockResolvedValue({
      ok: false,
      errors: [{ field: 'email', message: 'Enter a valid email address.' }],
    });
    const user = userEvent.setup();
    render(<EnquiryForm propertyId="prop-1" propertyTitle="Palatine Road semi" />);

    await user.click(screen.getByRole('button', { name: /Send enquiry/i }));

    const link = await screen.findByRole('link', { name: /Enter a valid email address/i });
    expect(link).toHaveAttribute('href', '#email');
  });
});
