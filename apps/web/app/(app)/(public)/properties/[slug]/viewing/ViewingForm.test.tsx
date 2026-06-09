// responsive-coverage: opt-out all — asserts the form composition + success/error
// states; responsive layout is the page-level Playwright e2e pass.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { VIEWING_CONSENT_TEXT } from './consent-text.js';

const submitViewing = vi.fn();
vi.mock('./actions.js', () => ({
  submitViewing: (...args: unknown[]) => submitViewing(...args),
}));

const { ViewingForm } = await import('./ViewingForm.js');

beforeEach(() => {
  vi.clearAllMocks();
  submitViewing.mockResolvedValue({ ok: false });
});

describe('ViewingForm', () => {
  it('renders the viewing fields (incl. the property + date) with verbatim consent', () => {
    render(<ViewingForm propertyId="p1" propertyTitle="Edwardian semi" />);
    expect(
      screen.getByRole('heading', { name: /Book a viewing of Edwardian semi/i }),
    ).toBeInTheDocument();
    expect(document.querySelector('input[name="propertyId"]')).toHaveValue('p1');
    expect(screen.getByLabelText(/Preferred date/i)).toBeRequired();
    expect(screen.getByLabelText(/Alternative date/i)).toBeInTheDocument();
    expect(screen.getByText(VIEWING_CONSENT_TEXT)).toBeInTheDocument();
  });

  it('shows the success confirmation after a successful submit', async () => {
    submitViewing.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<ViewingForm propertyId="p1" propertyTitle="Edwardian semi" />);

    await user.click(screen.getByRole('button', { name: /Request viewing/i }));

    expect(await screen.findByText(/viewing request has been sent/i)).toBeInTheDocument();
    expect(submitViewing).toHaveBeenCalledTimes(1);
  });

  it('surfaces a field-linked error summary returned by the action', async () => {
    submitViewing.mockResolvedValue({
      ok: false,
      errors: [{ field: 'preferredDate', message: 'Choose a preferred date.' }],
    });
    const user = userEvent.setup();
    render(<ViewingForm propertyId="p1" propertyTitle="Edwardian semi" />);

    await user.click(screen.getByRole('button', { name: /Request viewing/i }));

    const link = await screen.findByRole('link', { name: /Choose a preferred date/i });
    expect(link).toHaveAttribute('href', '#preferredDate');
  });
});
