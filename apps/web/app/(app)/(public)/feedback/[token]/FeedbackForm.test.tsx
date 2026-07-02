// responsive-coverage: opt-out all — asserts the form composition + success/error
// states; the responsive layout is the page-level Playwright pass.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FEEDBACK_CONSENT_TEXT } from '../consent-text.js';

const submitFeedback = vi.fn();
vi.mock('./actions.js', () => ({
  submitFeedback: (...args: unknown[]) => submitFeedback(...args),
}));

const { FeedbackForm } = await import('./FeedbackForm.js');

const savedSiteKey = process.env['NEXT_PUBLIC_TURNSTILE_SITE_KEY'];

beforeEach(() => {
  vi.clearAllMocks();
  submitFeedback.mockResolvedValue({ ok: false });
  // Turnstile is off by default so the plain-composition assertions stay stable;
  // the widget test opts it on.
  delete process.env['NEXT_PUBLIC_TURNSTILE_SITE_KEY'];
});

afterEach(() => {
  if (savedSiteKey === undefined) delete process.env['NEXT_PUBLIC_TURNSTILE_SITE_KEY'];
  else process.env['NEXT_PUBLIC_TURNSTILE_SITE_KEY'] = savedSiteKey;
});

describe('FeedbackForm', () => {
  it('renders the rating, comment, publish toggle, consent and the hidden token', () => {
    const { container } = render(<FeedbackForm token="tok.en.sig" />);
    expect(screen.getByLabelText(/rate your experience/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/anything you’d like to add/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/publish this as a testimonial/i)).toBeInTheDocument();
    expect(container.querySelector('input[name="token"]')).toHaveValue('tok.en.sig');
  });

  it('renders the required GDPR-consent affirmation verbatim (G5)', () => {
    render(<FeedbackForm token="tok.en.sig" />);
    expect(screen.getByText(FEEDBACK_CONSENT_TEXT)).toBeInTheDocument();
    expect(screen.getByLabelText(FEEDBACK_CONSENT_TEXT)).toBeRequired();
  });

  it('renders the Turnstile anti-spam challenge when a sitekey is configured (G8)', () => {
    process.env['NEXT_PUBLIC_TURNSTILE_SITE_KEY'] = 'test-site-key';
    const { container } = render(<FeedbackForm token="tok.en.sig" />);
    expect(screen.getByRole('group', { name: /security challenge/i })).toBeInTheDocument();
    expect(container.querySelector('input[name="cf-turnstile-response"]')).toBeInTheDocument();
  });

  it('omits the Turnstile challenge when no sitekey is configured', () => {
    const { container } = render(<FeedbackForm token="tok.en.sig" />);
    expect(screen.queryByRole('group', { name: /security challenge/i })).not.toBeInTheDocument();
    expect(container.querySelector('input[name="cf-turnstile-response"]')).toBeNull();
  });

  it('shows a thank-you after a successful submit', async () => {
    submitFeedback.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<FeedbackForm token="tok.en.sig" />);
    await user.click(screen.getByRole('button', { name: /send feedback/i }));
    expect(await screen.findByText(/thank you for your feedback/i)).toBeInTheDocument();
    expect(submitFeedback).toHaveBeenCalledTimes(1);
  });

  it('surfaces an error returned by the action', async () => {
    submitFeedback.mockResolvedValue({
      ok: false,
      errors: [{ field: 'rating', message: 'Please choose a rating.' }],
    });
    const user = userEvent.setup();
    render(<FeedbackForm token="tok.en.sig" />);
    await user.click(screen.getByRole('button', { name: /send feedback/i }));
    // The message appears in both the error summary and inline on the field.
    expect((await screen.findAllByText(/please choose a rating/i)).length).toBeGreaterThan(0);
  });
});
