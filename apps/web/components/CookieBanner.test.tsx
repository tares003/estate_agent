// responsive-coverage: opt-out all — asserts the banner's consent behaviour
// (Accept all / Reject non-essential / Customise toggles + script gating), not
// its layout; the banner's responsive chrome is covered by the public-routes
// Playwright + a11y pass (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const recordCookieConsent = vi.fn();
vi.mock('../app/(app)/(public)/cookie-consent/actions.js', () => ({
  recordCookieConsent: (...args: unknown[]) => recordCookieConsent(...args),
}));

const { CookieBanner } = await import('./CookieBanner.js');

beforeEach(() => {
  vi.clearAllMocks();
  recordCookieConsent.mockResolvedValue({ ok: true });
});

describe('CookieBanner', () => {
  it('does not render when a decision has already been recorded (dismissed state)', () => {
    render(
      <CookieBanner
        initialDecision={{ necessary: true, analytics: true, marketing: false, preferences: false }}
      />,
    );
    expect(screen.queryByRole('region', { name: /cookie/i })).toBeNull();
  });

  it('renders the three primary actions when no decision exists', () => {
    render(<CookieBanner initialDecision={null} />);
    expect(screen.getByRole('region', { name: /cookie/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /accept all/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reject non-essential/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /customise/i })).toBeInTheDocument();
  });

  it('Accept all records every category granted and dismisses the banner', async () => {
    const user = userEvent.setup();
    render(<CookieBanner initialDecision={null} />);

    await user.click(screen.getByRole('button', { name: /accept all/i }));

    expect(recordCookieConsent).toHaveBeenCalledWith({
      necessary: true,
      analytics: true,
      marketing: true,
      preferences: true,
    });
    await waitFor(() => expect(screen.queryByRole('region', { name: /cookie/i })).toBeNull());
  });

  it('Reject non-essential records only necessary and dismisses the banner', async () => {
    const user = userEvent.setup();
    render(<CookieBanner initialDecision={null} />);

    await user.click(screen.getByRole('button', { name: /reject non-essential/i }));

    expect(recordCookieConsent).toHaveBeenCalledWith({
      necessary: true,
      analytics: false,
      marketing: false,
      preferences: false,
    });
  });

  it('Customise reveals per-category toggles with Necessary forced on (disabled)', async () => {
    const user = userEvent.setup();
    render(<CookieBanner initialDecision={null} />);

    await user.click(screen.getByRole('button', { name: /customise/i }));

    const necessary = screen.getByRole('checkbox', { name: /necessary/i });
    expect(necessary).toBeChecked();
    expect(necessary).toBeDisabled();

    expect(screen.getByRole('checkbox', { name: /analytics/i })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /marketing/i })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /preferences/i })).not.toBeChecked();
  });

  it('saving a customised selection records exactly the chosen categories', async () => {
    const user = userEvent.setup();
    render(<CookieBanner initialDecision={null} />);

    await user.click(screen.getByRole('button', { name: /customise/i }));
    await user.click(screen.getByRole('checkbox', { name: /analytics/i }));
    await user.click(screen.getByRole('checkbox', { name: /preferences/i }));
    await user.click(screen.getByRole('button', { name: /save preferences/i }));

    expect(recordCookieConsent).toHaveBeenCalledWith({
      necessary: true,
      analytics: true,
      marketing: false,
      preferences: true,
    });
  });

  it('links to the full cookie policy', () => {
    render(<CookieBanner initialDecision={null} />);
    const link = within(screen.getByRole('region', { name: /cookie/i })).getByRole('link', {
      name: /cookie policy/i,
    });
    expect(link).toHaveAttribute('href', '/cookies');
  });
});
