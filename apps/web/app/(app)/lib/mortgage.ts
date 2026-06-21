import type { MortgageInput } from '@estate/validators';

// EPIC-W FR-W-6 — the indicative mortgage maths (pure, no React/DB). INDICATIVE
// ONLY (PRODUCT.md §9 — not financial advice); the calculator UI renders the
// "For guidance only — not financial advice" disclosure adjacent to this result
// (FR-W-10). The input is validated by `mortgageInputSchema` (@estate/validators)
// at the form boundary, so this assumes well-formed numbers.

/** The computed indicative-mortgage figures (money in GBP, rounded to the penny). */
export interface MortgageResult {
  /** Amount borrowed = purchase price − deposit (never negative). */
  loanAmount: number;
  /** Indicative monthly repayment (capital + interest). */
  monthlyRepayment: number;
  /** Total interest paid over the full term. */
  totalInterest: number;
  /** Total amount payable over the full term (principal + interest). */
  totalPayable: number;
  /** Loan-to-value as a percentage of the purchase price. */
  ltvPercent: number;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Compute the indicative monthly repayment, totals and LTV for a repayment
 * mortgage using the standard amortisation formula
 * `M = P·r·(1+r)^n / ((1+r)^n − 1)`, where `r` is the monthly rate and `n` the
 * number of monthly payments. A 0% rate degrades to straight-line principal
 * division; a zero loan (cash purchase) yields zeroes.
 */
export function computeMortgage(input: MortgageInput): MortgageResult {
  const loanAmount = Math.max(0, input.purchasePrice - input.deposit);
  const months = input.termYears * 12;
  const monthlyRate = input.annualRatePercent / 100 / 12;

  let monthlyRepayment: number;
  if (loanAmount === 0 || months === 0) {
    monthlyRepayment = 0;
  } else if (monthlyRate === 0) {
    monthlyRepayment = loanAmount / months;
  } else {
    const growth = Math.pow(1 + monthlyRate, months);
    monthlyRepayment = (loanAmount * monthlyRate * growth) / (growth - 1);
  }

  const totalPayable = monthlyRepayment * months;
  const totalInterest = totalPayable - loanAmount;
  const ltvPercent = input.purchasePrice > 0 ? (loanAmount / input.purchasePrice) * 100 : 0;

  return {
    loanAmount,
    monthlyRepayment: round2(monthlyRepayment),
    totalInterest: round2(totalInterest),
    totalPayable: round2(totalPayable),
    ltvPercent: round2(ltvPercent),
  };
}
