// responsive-coverage: opt-out all — asserts the form composition + success/error
// states; the responsive layout is the page-level Playwright pass.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const submitFeedback = vi.fn();
vi.mock('./actions.js', () => ({
  submitFeedback: (...args: unknown[]) => submitFeedback(...args),
}));

const { FeedbackForm } = await import('./FeedbackForm.js');

beforeEach(() => {
  vi.clearAllMocks();
  submitFeedback.mockResolvedValue({ ok: false });
});

describe('FeedbackForm', () => {
  it('renders the rating, comment, publish toggle and the hidden token', () => {
    const { container } = render(<FeedbackForm token="tok.en.sig" />);
    expect(screen.getByLabelText(/rate your experience/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/anything you’d like to add/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/publish this as a testimonial/i)).toBeInTheDocument();
    expect(container.querySelector('input[name="token"]')).toHaveValue('tok.en.sig');
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
