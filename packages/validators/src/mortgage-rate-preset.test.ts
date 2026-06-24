import { describe, expect, it } from 'vitest';

import {
  MORTGAGE_PRESET_LABEL_MAX,
  mortgageRatePresetSchema,
  mortgageRatePresetCreateSchema,
  type MortgageRatePresetInput,
} from './mortgage-rate-preset.js';

// EPIC-W FR-W-8 — the admin-managed mortgage rate preset schema. A preset is a named
// rate snapshot (e.g. "2-year fixed", "5-year fixed") an admin curates so a visitor
// can one-tap-apply it in the public calculator's preset dropdown. The schema is the
// single gate between the admin editor and persistence. INDICATIVE ONLY (PRODUCT.md
// §9 — not financial advice) and captures NO personal data (configuration), so it
// carries no GDPR-consent affirmation. Ranges mirror the public mortgageInputSchema:
// rate is a percentage in [0, 100]; term is a whole number of years in [1, 40].

const GOOD: MortgageRatePresetInput = {
  label: '2-year fixed',
  annualRatePercent: 4.79,
  termYears: 25,
};

describe('mortgageRatePresetSchema', () => {
  it('accepts a well-formed preset', () => {
    expect(mortgageRatePresetSchema.safeParse(GOOD).success).toBe(true);
  });

  it('trims and requires a non-empty label', () => {
    expect(mortgageRatePresetSchema.safeParse({ ...GOOD, label: '   ' }).success).toBe(false);
  });

  it('rejects a label longer than the maximum', () => {
    const label = 'x'.repeat(MORTGAGE_PRESET_LABEL_MAX + 1);
    expect(mortgageRatePresetSchema.safeParse({ ...GOOD, label }).success).toBe(false);
  });

  it('rejects a negative rate', () => {
    expect(mortgageRatePresetSchema.safeParse({ ...GOOD, annualRatePercent: -1 }).success).toBe(
      false,
    );
  });

  it('rejects a rate above 100%', () => {
    expect(mortgageRatePresetSchema.safeParse({ ...GOOD, annualRatePercent: 101 }).success).toBe(
      false,
    );
  });

  it('rejects a non-positive term', () => {
    expect(mortgageRatePresetSchema.safeParse({ ...GOOD, termYears: 0 }).success).toBe(false);
  });

  it('rejects a non-integer term', () => {
    expect(mortgageRatePresetSchema.safeParse({ ...GOOD, termYears: 25.5 }).success).toBe(false);
  });

  it('rejects a term above 40 years', () => {
    expect(mortgageRatePresetSchema.safeParse({ ...GOOD, termYears: 41 }).success).toBe(false);
  });
});

describe('mortgageRatePresetCreateSchema', () => {
  it('coerces numeric strings from the admin form', () => {
    const result = mortgageRatePresetCreateSchema.safeParse({
      label: '5-year fixed',
      annualRatePercent: '4.99',
      termYears: '30',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.annualRatePercent).toBe(4.99);
      expect(result.data.termYears).toBe(30);
    }
  });

  it('rejects a blank label from the form', () => {
    const result = mortgageRatePresetCreateSchema.safeParse({
      label: '',
      annualRatePercent: '4.5',
      termYears: '25',
    });
    expect(result.success).toBe(false);
  });
});
