// responsive-coverage: opt-out all — this asserts the form's composition and its
// success/error states; the responsive layout is covered by the page-level
// Playwright e2e pass (design-requirements §3).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

afterEach(() => vi.unstubAllEnvs());

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

  it('renders the Turnstile anti-spam challenge when a sitekey is configured', () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'site-key-123');
    render(<EnquiryForm propertyId="prop-1" propertyTitle="Palatine Road semi" />);

    expect(screen.getByRole('group', { name: /security challenge/i })).toBeInTheDocument();
    expect(document.querySelector('input[name="cf-turnstile-response"]')).toBeInTheDocument();
  });

  it('omits the challenge when no sitekey is configured (dev/test)', () => {
    render(<EnquiryForm propertyId="prop-1" propertyTitle="Palatine Road semi" />);

    expect(screen.queryByRole('group', { name: /security challenge/i })).not.toBeInTheDocument();
    expect(document.querySelector('input[name="cf-turnstile-response"]')).not.toBeInTheDocument();
  });
});
