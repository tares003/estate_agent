import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MortgageCalculator } from './MortgageCalculator.js';

// EPIC-W FR-W-6/10 — the indicative mortgage calculator UI. It computes live from
// the inputs (no server round-trip) and MUST show the "not financial advice"
// disclosure adjacent to the result (FR-W-10 / PRODUCT.md §8).

describe('MortgageCalculator', () => {
  it('shows an indicative monthly repayment from the default inputs', () => {
    render(<MortgageCalculator />);
    // Default £300k / £60k / 4.5% / 25y → ≈ £1,333.97/month.
    expect(screen.getByTestId('monthly-repayment').textContent).toMatch(/£1,333\.97/);
  });

  it('renders the "not financial advice" disclosure adjacent to the result (FR-W-10)', () => {
    render(<MortgageCalculator />);
    expect(screen.getByText(/not financial advice/i)).toBeInTheDocument();
  });

  it('recomputes when an input changes', () => {
    render(<MortgageCalculator />);
    const before = screen.getByTestId('monthly-repayment').textContent;
    // Raise the rate → the monthly repayment must increase.
    fireEvent.change(screen.getByLabelText(/interest rate/i), { target: { value: '6' } });
    const after = screen.getByTestId('monthly-repayment').textContent;
    expect(after).not.toBe(before);
  });

  it('shows a prompt instead of a result when the inputs are not yet valid', () => {
    render(<MortgageCalculator />);
    // Deposit greater than price → invalid (mortgageInputSchema refine) → no result.
    fireEvent.change(screen.getByLabelText(/deposit/i), { target: { value: '999999999' } });
    expect(screen.queryByTestId('monthly-repayment')).not.toBeInTheDocument();
    expect(screen.getByText(/enter your details/i)).toBeInTheDocument();
  });
});
