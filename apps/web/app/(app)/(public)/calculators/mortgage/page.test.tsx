// responsive-coverage: opt-out all — asserts the page shell + metadata; the
// calculator is covered by MortgageCalculator.test, responsive layout by Playwright.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../lib/tenant.js', () => ({
  getRequestOrigin: async () => 'https://acme.test',
  getCurrentTenantId: async () => '00000000-0000-0000-0000-000000000001',
}));
vi.mock('../../../lib/db.js', () => ({ getDb: () => ({}) }));
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) => fn({}),
}));
const loadMortgageRateConfig = vi.fn(async () => ({
  defaultAnnualRatePercent: 4.5,
  defaultTermYears: 25,
  defaultDepositPercent: 20,
  lastReviewed: '2026-04-01',
}));
vi.mock('../../../lib/mortgage-rate-config.js', () => ({
  loadMortgageRateConfig: () => loadMortgageRateConfig(),
}));
// The calculator is a client component (useState) — stub it so the page test
// focuses on the shell.
vi.mock('./MortgageCalculator.js', () => ({
  MortgageCalculator: () => <div data-testid="mortgage-calculator" />,
}));

const { default: MortgageCalculatorPage, generateMetadata } = await import('./page.js');

describe('MortgageCalculatorPage', () => {
  it('renders the heading + the calculator and loads the tenant config', async () => {
    render(await MortgageCalculatorPage());
    expect(
      screen.getByRole('heading', { level: 1, name: 'Mortgage calculator' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('mortgage-calculator')).toBeInTheDocument();
    expect(loadMortgageRateConfig).toHaveBeenCalled();
  });

  it('builds canonical metadata for the calculator page', async () => {
    const meta = await generateMetadata();
    expect(meta.alternates?.canonical).toBe('https://acme.test/calculators/mortgage');
    expect(meta.title).toBe('Mortgage calculator');
  });
});
