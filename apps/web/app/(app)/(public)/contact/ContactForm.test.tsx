// responsive-coverage: opt-out all — asserts the form composition + success/error
// states; the responsive layout is the page-level Playwright e2e pass
// (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CONTACT_CONSENT_TEXT } from './consent-text.js';

const submitContact = vi.fn();
vi.mock('./actions.js', () => ({
  submitContact: (...args: unknown[]) => submitContact(...args),
}));

const { ContactForm } = await import('./ContactForm.js');

beforeEach(() => {
  vi.clearAllMocks();
  submitContact.mockResolvedValue({ ok: false });
});

describe('ContactForm', () => {
  it('renders the contact fields with the verbatim consent affirmation', () => {
    render(<ContactForm />);
    expect(screen.getByLabelText(/Your name/i)).toBeRequired();
    expect(screen.getByLabelText(/^Email/i)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /^Message/i })).toBeRequired();
    expect(screen.getByText(CONTACT_CONSENT_TEXT)).toBeInTheDocument();
  });

  it('shows the success confirmation after a successful submit', async () => {
    submitContact.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<ContactForm />);

    await user.click(screen.getByRole('button', { name: /Send message/i }));

    expect(await screen.findByText(/Your message has been sent/i)).toBeInTheDocument();
    expect(submitContact).toHaveBeenCalledTimes(1);
  });

  it('surfaces a field-linked error summary returned by the action', async () => {
    submitContact.mockResolvedValue({
      ok: false,
      errors: [{ field: 'message', message: 'Please enter a message.' }],
    });
    const user = userEvent.setup();
    render(<ContactForm />);

    await user.click(screen.getByRole('button', { name: /Send message/i }));

    const link = await screen.findByRole('link', { name: /Please enter a message/i });
    expect(link).toHaveAttribute('href', '#message');
  });
});
