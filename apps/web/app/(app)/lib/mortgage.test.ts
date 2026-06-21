import { describe, expect, it } from 'vitest';

import { computeMortgage } from './mortgage.js';

// EPIC-W FR-W-6 — the indicative mortgage maths. Standard amortisation:
// M = P·r·(1+r)^n / ((1+r)^n − 1), with the zero-rate and zero-loan edges handled.
// Indicative only (PRODUCT.md §9); the UI carries the "not financial advice" note.

describe('computeMortgage', () => {
  it('computes the monthly repayment, totals and LTV for a typical loan', () => {
    // £300k price, £60k deposit → £240k loan at 4.5% over 25y.
    const r = computeMortgage({
      purchasePrice: 300_000,
      deposit: 60_000,
      annualRatePercent: 4.5,
      termYears: 25,
    });
    expect(r.loanAmount).toBe(240_000);
    // Textbook value for these inputs is ≈ £1,333.97/month.
    expect(r.monthlyRepayment).toBeCloseTo(1333.97, 1);
    expect(r.ltvPercent).toBe(80);
    // Total payable ≈ £400,190 over 300 payments; interest is the balance over the
    // £240k principal (an exact relationship since the loan is a whole number).
    expect(r.totalPayable).toBeGreaterThan(400_000);
    expect(r.totalPayable).toBeLessThan(400_500);
    expect(r.totalInterest).toBeCloseTo(r.totalPayable - 240_000, 2);
  });

  it('handles a 0% rate as straight-line principal division (no interest)', () => {
    const r = computeMortgage({
      purchasePrice: 240_000,
      deposit: 0,
      annualRatePercent: 0,
      termYears: 20,
    });
    expect(r.monthlyRepayment).toBeCloseTo(240_000 / 240, 2); // 240 months
    expect(r.totalInterest).toBe(0);
    expect(r.totalPayable).toBeCloseTo(240_000, 2);
    expect(r.ltvPercent).toBe(100);
  });

  it('treats a full-cash purchase (deposit = price) as a zero loan', () => {
    const r = computeMortgage({
      purchasePrice: 250_000,
      deposit: 250_000,
      annualRatePercent: 5,
      termYears: 25,
    });
    expect(r.loanAmount).toBe(0);
    expect(r.monthlyRepayment).toBe(0);
    expect(r.totalInterest).toBe(0);
    expect(r.totalPayable).toBe(0);
    expect(r.ltvPercent).toBe(0);
  });

  it('rounds money to the penny and LTV to two places', () => {
    const r = computeMortgage({
      purchasePrice: 333_333,
      deposit: 33_333,
      annualRatePercent: 3.79,
      termYears: 30,
    });
    // Every monetary figure is rounded to 2 dp (no long floating tails).
    for (const v of [r.monthlyRepayment, r.totalInterest, r.totalPayable, r.ltvPercent]) {
      expect(Math.round(v * 100) / 100).toBe(v);
    }
    expect(r.loanAmount).toBe(300_000);
  });
});
