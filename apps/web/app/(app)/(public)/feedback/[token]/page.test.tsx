// responsive-coverage: opt-out all — asserts the token gate + the shell; the form
// is covered by FeedbackForm.test, responsive layout by Playwright.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { signFeedbackToken } from '../../../lib/feedback-access.js';

vi.mock('./FeedbackForm.js', () => ({
  FeedbackForm: ({ token }: { token: string }) => <div data-testid="feedback-form" data-token={token} />,
}));

const { default: FeedbackPage } = await import('./page.js');

const SECRET = 'page-test-secret';
const savedSecret = process.env['FEEDBACK_LINK_SECRET'];

beforeEach(() => {
  process.env['FEEDBACK_LINK_SECRET'] = SECRET;
});
afterEach(() => {
  if (savedSecret === undefined) delete process.env['FEEDBACK_LINK_SECRET'];
  else process.env['FEEDBACK_LINK_SECRET'] = savedSecret;
});

describe('FeedbackPage', () => {
  it('renders the heading + the form for a valid token', async () => {
    const token = signFeedbackToken(
      { tenantId: '00000000-0000-0000-0000-000000000001', triggerType: 'viewing_attended' },
      Date.now() + 60_000,
      SECRET,
    );
    const ui = await FeedbackPage({ params: Promise.resolve({ token }) });
    render(ui);
    expect(screen.getByRole('heading', { level: 1, name: /share your feedback/i })).toBeInTheDocument();
    expect(screen.getByTestId('feedback-form')).toHaveAttribute('data-token', token);
  });

  it('404s (notFound) on an invalid / expired token', async () => {
    // next/navigation's notFound() throws a control-flow error.
    await expect(FeedbackPage({ params: Promise.resolve({ token: 'not-a-real-token' }) })).rejects.toThrow();
  });
});
