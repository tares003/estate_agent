// responsive-coverage: opt-out all — asserts the page shell + metadata; the
// calculator is covered by MortgageCalculator.test, responsive layout by Playwright.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../lib/tenant.js', () => ({ getRequestOrigin: async () => 'https://acme.test' }));
// The calculator is a client component (useState) — stub it so the page test
// focuses on the shell.
vi.mock('./MortgageCalculator.js', () => ({
  MortgageCalculator: () => <div data-testid="mortgage-calculator" />,
}));

const { default: MortgageCalculatorPage, generateMetadata } = await import('./page.js');

describe('MortgageCalculatorPage', () => {
  it('renders the heading + the calculator', () => {
    render(<MortgageCalculatorPage />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Mortgage calculator' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('mortgage-calculator')).toBeInTheDocument();
  });

  it('builds canonical metadata for the calculator page', async () => {
    const meta = await generateMetadata();
    expect(meta.alternates?.canonical).toBe('https://acme.test/calculators/mortgage');
    expect(meta.title).toBe('Mortgage calculator');
  });
});
