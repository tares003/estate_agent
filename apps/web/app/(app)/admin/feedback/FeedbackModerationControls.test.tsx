// responsive-coverage: opt-out all — asserts the control behaviour; layout is the
// admin-routes Playwright pass (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const moderateFeedback = vi.fn();
vi.mock('./actions.js', () => ({
  moderateFeedback: (...args: unknown[]) => moderateFeedback(...args),
}));

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const { FeedbackModerationControls } = await import('./FeedbackModerationControls.js');

beforeEach(() => {
  vi.clearAllMocks();
  moderateFeedback.mockResolvedValue({ ok: true });
});

describe('FeedbackModerationControls', () => {
  it('publishes — submits the feedback id and decision=publish', async () => {
    const user = userEvent.setup();
    render(<FeedbackModerationControls feedbackId="fb-1" />);
    await user.click(screen.getByRole('button', { name: 'Publish' }));

    expect(moderateFeedback).toHaveBeenCalledTimes(1);
    const fd = moderateFeedback.mock.calls[0]?.[1] as FormData;
    expect(fd.get('feedbackId')).toBe('fb-1');
    expect(fd.get('decision')).toBe('publish');
    // The decided row leaves the queue — refresh the server-rendered list.
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('reveals a required reason field before a reject can be submitted', async () => {
    const user = userEvent.setup();
    render(<FeedbackModerationControls feedbackId="fb-1" />);

    // The reason field is hidden until the reject path is opened.
    expect(screen.queryByLabelText(/reason/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reject' }));

    const reason = screen.getByLabelText(/reason/i);
    expect(reason).toBeInTheDocument();
    expect(reason).toBeRequired();
    // Opening the reveal does not submit on its own.
    expect(moderateFeedback).not.toHaveBeenCalled();
  });

  it('rejects — submits the reason and decision=reject', async () => {
    const user = userEvent.setup();
    render(<FeedbackModerationControls feedbackId="fb-1" />);

    await user.click(screen.getByRole('button', { name: 'Reject' }));
    await user.type(screen.getByLabelText(/reason/i), 'Off-topic comment');
    await user.click(screen.getByRole('button', { name: 'Confirm rejection' }));

    expect(moderateFeedback).toHaveBeenCalledTimes(1);
    const fd = moderateFeedback.mock.calls[0]?.[1] as FormData;
    expect(fd.get('feedbackId')).toBe('fb-1');
    expect(fd.get('decision')).toBe('reject');
    expect(fd.get('reason')).toBe('Off-topic comment');
  });

  it('surfaces a field-linked error returned by the action', async () => {
    moderateFeedback.mockResolvedValue({
      ok: false,
      errors: [{ field: 'reason', message: 'A reason is required when rejecting feedback.' }],
    });
    const user = userEvent.setup();
    render(<FeedbackModerationControls feedbackId="fb-1" />);

    await user.click(screen.getByRole('button', { name: 'Reject' }));
    await user.type(screen.getByLabelText(/reason/i), 'too short');
    await user.click(screen.getByRole('button', { name: 'Confirm rejection' }));

    expect(
      await screen.findByText('A reason is required when rejecting feedback.'),
    ).toBeInTheDocument();
  });
});
