// responsive-coverage: opt-out all — asserts the page shell + metadata; the
// calculator is covered by StampDutyCalculator.test, responsive by Playwright.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../lib/tenant.js', () => ({ getRequestOrigin: async () => 'https://acme.test' }));
vi.mock('./StampDutyCalculator.js', () => ({
  StampDutyCalculator: () => <div data-testid="stamp-duty-calculator" />,
}));

const { default: StampDutyCalculatorPage, generateMetadata } = await import('./page.js');

describe('StampDutyCalculatorPage', () => {
  it('renders the heading + the calculator', () => {
    render(<StampDutyCalculatorPage />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Stamp duty calculator' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('stamp-duty-calculator')).toBeInTheDocument();
  });

  it('builds canonical metadata for the calculator page', async () => {
    const meta = await generateMetadata();
    expect(meta.alternates?.canonical).toBe('https://acme.test/calculators/stamp-duty');
    expect(meta.title).toBe('Stamp duty calculator');
  });
});
