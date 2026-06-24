// responsive-coverage: opt-out all — asserts the editor behaviour; layout is the
// admin-routes Playwright pass (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { DEFAULT_MORTGAGE_RATE_CONFIG } from '../../../lib/mortgage.js';

const saveMortgageRateConfig = vi.fn();
vi.mock('./actions.js', () => ({
  saveMortgageRateConfig: (...args: unknown[]) => saveMortgageRateConfig(...args),
}));

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const { MortgageRateConfigEditor } = await import('./MortgageRateConfigEditor.js');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MortgageRateConfigEditor', () => {
  it('pre-fills the default annual rate', () => {
    render(<MortgageRateConfigEditor config={DEFAULT_MORTGAGE_RATE_CONFIG} />);
    const rate = screen.getByLabelText(/interest rate/i) as HTMLInputElement;
    expect(rate.value).toBe(String(DEFAULT_MORTGAGE_RATE_CONFIG.defaultAnnualRatePercent));
  });

  it('shows the default term and deposit percentage', () => {
    render(<MortgageRateConfigEditor config={DEFAULT_MORTGAGE_RATE_CONFIG} />);
    const term = screen.getByLabelText(/term/i) as HTMLInputElement;
    expect(term.value).toBe(String(DEFAULT_MORTGAGE_RATE_CONFIG.defaultTermYears));
    const deposit = screen.getByLabelText(/deposit/i) as HTMLInputElement;
    expect(deposit.value).toBe(String(DEFAULT_MORTGAGE_RATE_CONFIG.defaultDepositPercent));
  });

  it('shows a Save control', () => {
    render(<MortgageRateConfigEditor config={DEFAULT_MORTGAGE_RATE_CONFIG} />);
    expect(screen.getByRole('button', { name: /save/i })).toBeTruthy();
  });
});
