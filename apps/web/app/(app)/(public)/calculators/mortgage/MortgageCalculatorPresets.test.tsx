// responsive-coverage: opt-out all — asserts the FR-W-8 preset-dropdown behaviour;
// the responsive layout is covered by the page-level Playwright e2e pass
// (design-requirements §3).
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MortgageCalculator } from './MortgageCalculator.js';

// EPIC-W FR-W-8 — the indicative mortgage calculator's preset dropdown. Admin-managed
// rate snapshots ("2-year fixed", "5-year fixed") are passed in as `presets`; choosing
// one applies its rate + term to the calculator's inputs, recomputing the result. The
// dropdown is omitted entirely when no presets are configured.

const PRESETS = [
  { id: 'p1', label: '2-year fixed', annualRatePercent: 6, termYears: 25 },
  { id: 'p2', label: '5-year fixed', annualRatePercent: 4.49, termYears: 30 },
];

describe('MortgageCalculator preset dropdown (FR-W-8)', () => {
  it('renders a preset dropdown with the admin-managed snapshots', () => {
    render(<MortgageCalculator presets={PRESETS} />);
    const select = screen.getByLabelText(/preset/i) as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /2-year fixed/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /5-year fixed/i })).toBeInTheDocument();
  });

  it('applies the chosen preset rate and term, recomputing the result', () => {
    render(<MortgageCalculator presets={PRESETS} />);
    const before = screen.getByTestId('monthly-repayment').textContent;
    fireEvent.change(screen.getByLabelText(/preset/i), { target: { value: 'p1' } });
    // The rate field now reflects the 2-year preset's 6% rate.
    expect((screen.getByLabelText(/interest rate/i) as HTMLInputElement).value).toBe('6');
    expect((screen.getByLabelText(/^term/i) as HTMLInputElement).value).toBe('25');
    expect(screen.getByTestId('monthly-repayment').textContent).not.toBe(before);
  });

  it('omits the preset dropdown when no presets are configured', () => {
    render(<MortgageCalculator presets={[]} />);
    expect(screen.queryByLabelText(/preset/i)).not.toBeInTheDocument();
  });

  it('omits the preset dropdown when presets prop is not provided', () => {
    render(<MortgageCalculator />);
    expect(screen.queryByLabelText(/preset/i)).not.toBeInTheDocument();
  });
});
