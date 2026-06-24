// responsive-coverage: opt-out all — ConsentGatedScript renders nothing visual;
// it is a pure consent gate around non-essential <script> children (FR-C-12), so
// there is no layout to assert across breakpoints.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

const readConsentDecision = vi.fn();
vi.mock('../app/(app)/lib/cookie-consent-server.js', () => ({
  readConsentDecision: () => readConsentDecision(),
}));

const { ConsentGatedScript } = await import('./ConsentGatedScript.js');

/** Render the async server component to its resolved markup. */
async function renderGated(category: 'analytics' | 'marketing' | 'preferences') {
  const ui = await ConsentGatedScript({
    category,
    children: <script data-testid="gated" src="/x.js" />,
  });
  return render(ui);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ConsentGatedScript', () => {
  it('does NOT render its non-essential script when no decision exists (gate closed pre-consent)', async () => {
    readConsentDecision.mockResolvedValue(null);
    const { queryByTestId } = await renderGated('analytics');
    expect(queryByTestId('gated')).toBeNull();
  });

  it('does NOT render its script when the category was rejected', async () => {
    readConsentDecision.mockResolvedValue({
      necessary: true,
      analytics: false,
      marketing: false,
      preferences: false,
    });
    const { queryByTestId } = await renderGated('analytics');
    expect(queryByTestId('gated')).toBeNull();
  });

  it('renders its script only once the category is granted (post-consent)', async () => {
    readConsentDecision.mockResolvedValue({
      necessary: true,
      analytics: true,
      marketing: false,
      preferences: false,
    });
    const { queryByTestId } = await renderGated('analytics');
    expect(queryByTestId('gated')).not.toBeNull();
  });

  it('gates each non-essential category independently', async () => {
    readConsentDecision.mockResolvedValue({
      necessary: true,
      analytics: true,
      marketing: false,
      preferences: false,
    });
    expect((await renderGated('marketing')).queryByTestId('gated')).toBeNull();
    readConsentDecision.mockResolvedValue({
      necessary: true,
      analytics: false,
      marketing: true,
      preferences: false,
    });
    expect((await renderGated('marketing')).queryByTestId('gated')).not.toBeNull();
  });
});
