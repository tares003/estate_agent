import { describe, expect, it } from 'vitest';

import { mortgageRateConfigSchema, type MortgageRateConfigInput } from './mortgage-rate-config.js';

// EPIC-W FR-W-7 — the admin-editable mortgage-default configuration schema. Validates
// the defaults the public mortgage calculator pre-fills: the illustrative annual
// interest rate, the default term (whole years), the default deposit percentage, and
// the ISO date the guidance was last reviewed. The schema is the gate between the
// admin editor and persistence, so it rejects out-of-range / malformed input.
// INDICATIVE ONLY (PRODUCT.md §9 — not financial advice) and captures NO personal
// data (configuration only), so no GDPR consent affirmation.

const GOOD: MortgageRateConfigInput = {
  defaultAnnualRatePercent: 4.5,
  defaultTermYears: 25,
  defaultDepositPercent: 20,
  lastReviewed: '2026-04-01',
};

describe('mortgageRateConfigSchema', () => {
  it('accepts a well-formed config', () => {
    const result = mortgageRateConfigSchema.safeParse(GOOD);
    expect(result.success).toBe(true);
  });

  it('rejects a negative rate', () => {
    const result = mortgageRateConfigSchema.safeParse({ ...GOOD, defaultAnnualRatePercent: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects a rate above 100%', () => {
    const result = mortgageRateConfigSchema.safeParse({ ...GOOD, defaultAnnualRatePercent: 101 });
    expect(result.success).toBe(false);
  });

  it('rejects a non-positive term', () => {
    const result = mortgageRateConfigSchema.safeParse({ ...GOOD, defaultTermYears: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects a non-integer term', () => {
    const result = mortgageRateConfigSchema.safeParse({ ...GOOD, defaultTermYears: 25.5 });
    expect(result.success).toBe(false);
  });

  it('rejects a term above 40 years', () => {
    const result = mortgageRateConfigSchema.safeParse({ ...GOOD, defaultTermYears: 41 });
    expect(result.success).toBe(false);
  });

  it('rejects a negative deposit percentage', () => {
    const result = mortgageRateConfigSchema.safeParse({ ...GOOD, defaultDepositPercent: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects a deposit percentage above 100%', () => {
    const result = mortgageRateConfigSchema.safeParse({ ...GOOD, defaultDepositPercent: 101 });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed lastReviewed date', () => {
    const result = mortgageRateConfigSchema.safeParse({ ...GOOD, lastReviewed: '01/04/2026' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing lastReviewed', () => {
    const { lastReviewed: _omit, ...withoutDate } = GOOD;
    const result = mortgageRateConfigSchema.safeParse(withoutDate);
    expect(result.success).toBe(false);
  });
});
