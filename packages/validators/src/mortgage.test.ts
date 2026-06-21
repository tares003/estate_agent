import { describe, expect, it } from 'vitest';

import { mortgageInputSchema } from './mortgage.js';

// EPIC-W FR-W-5 — the indicative mortgage calculator's input. A pure numeric form
// (purchase price, deposit, annual rate, term); it captures NO personal data
// (FR-W-11), so — unlike the lead forms — it carries no consent affirmation.

const VALID = { purchasePrice: 300_000, deposit: 60_000, annualRatePercent: 4.5, termYears: 25 };

describe('mortgageInputSchema', () => {
  it('accepts a well-formed indicative-mortgage input', () => {
    const parsed = mortgageInputSchema.parse(VALID);
    expect(parsed).toEqual(VALID);
  });

  it('rejects a deposit greater than the purchase price', () => {
    const result = mortgageInputSchema.safeParse({ ...VALID, deposit: 400_000 });
    expect(result.success).toBe(false);
  });

  it('allows a deposit equal to the purchase price (a cash purchase — zero loan)', () => {
    expect(mortgageInputSchema.safeParse({ ...VALID, deposit: VALID.purchasePrice }).success).toBe(
      true,
    );
  });

  it('rejects a non-positive price, a negative rate, and a zero / non-integer term', () => {
    expect(mortgageInputSchema.safeParse({ ...VALID, purchasePrice: 0 }).success).toBe(false);
    expect(mortgageInputSchema.safeParse({ ...VALID, deposit: -1 }).success).toBe(false);
    expect(mortgageInputSchema.safeParse({ ...VALID, annualRatePercent: -0.1 }).success).toBe(false);
    expect(mortgageInputSchema.safeParse({ ...VALID, termYears: 0 }).success).toBe(false);
    expect(mortgageInputSchema.safeParse({ ...VALID, termYears: 25.5 }).success).toBe(false);
  });

  it('coerces numeric strings from form inputs', () => {
    const parsed = mortgageInputSchema.parse({
      purchasePrice: '300000',
      deposit: '60000',
      annualRatePercent: '4.5',
      termYears: '25',
    });
    expect(parsed.purchasePrice).toBe(300_000);
    expect(parsed.termYears).toBe(25);
  });
});
