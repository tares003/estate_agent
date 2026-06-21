import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SDLT_CONFIG,
  computeStampDuty,
  type SdltConfig,
} from './stamp-duty.js';

// EPIC-W FR-W-2/4 — the indicative SDLT engine. The BAND-APPLICATION logic is what
// matters and is proven here against SYNTHETIC bands, so the test asserts the
// progressive maths (not HMRC's actual rates, which are admin-configurable per
// FR-W-3 precisely because they change). A light sanity check covers the shipped
// default config without pinning specific legal amounts.

// Synthetic bands: nil to 100k, 5% to 200k, 10% above.
const CONFIG: SdltConfig = {
  standardBands: [
    { upTo: 100_000, ratePercent: 0 },
    { upTo: 200_000, ratePercent: 5 },
    { upTo: null, ratePercent: 10 },
  ],
  firstTimeBuyer: {
    maxPrice: 300_000,
    bands: [
      { upTo: 150_000, ratePercent: 0 },
      { upTo: null, ratePercent: 5 },
    ],
  },
  additionalPropertySurchargePercent: 3,
  lastUpdated: '2025-04-01',
};

describe('computeStampDuty — progressive band application', () => {
  it('applies each band to the slice of price within it (home mover)', () => {
    const r = computeStampDuty({ purchasePrice: 250_000, buyerCategory: 'home_mover' }, CONFIG);
    // 0% of 100k + 5% of 100k + 10% of 50k = 0 + 5000 + 5000 = 10000.
    expect(r.totalTax).toBe(10_000);
    expect(r.effectiveRatePercent).toBe(4); // 10000 / 250000
    expect(r.lastUpdated).toBe('2025-04-01');
  });

  it('breaks the tax down per band, omitting bands the price does not reach', () => {
    const r = computeStampDuty({ purchasePrice: 150_000, buyerCategory: 'home_mover' }, CONFIG);
    // Reaches into band 2 (100k–200k) but not band 3.
    expect(r.breakdown).toEqual([
      { from: 0, to: 100_000, ratePercent: 0, taxable: 100_000, tax: 0 },
      { from: 100_000, to: 200_000, ratePercent: 5, taxable: 50_000, tax: 2500 },
    ]);
    expect(r.totalTax).toBe(2500);
  });

  it('uses the first-time-buyer bands when the price is within the relief cap', () => {
    const r = computeStampDuty({ purchasePrice: 250_000, buyerCategory: 'first_time_buyer' }, CONFIG);
    // FTB: 0% of 150k + 5% of 100k = 5000.
    expect(r.totalTax).toBe(5000);
  });

  it('falls back to standard bands when a first-time buyer exceeds the relief cap', () => {
    const r = computeStampDuty({ purchasePrice: 400_000, buyerCategory: 'first_time_buyer' }, CONFIG);
    // Over maxPrice 300k → standard bands: 0 + 5000 + 10% of 200k = 25000.
    expect(r.totalTax).toBe(25_000);
  });

  it('adds the additional-property surcharge to every band', () => {
    const r = computeStampDuty(
      { purchasePrice: 250_000, buyerCategory: 'additional_property' },
      CONFIG,
    );
    // Surcharged rates 3/8/13: 3% of 100k + 8% of 100k + 13% of 50k = 3000+8000+6500.
    expect(r.totalTax).toBe(17_500);
  });

  it('returns zero tax (and 0% effective) for a price entirely within the nil band', () => {
    const r = computeStampDuty({ purchasePrice: 80_000, buyerCategory: 'home_mover' }, CONFIG);
    expect(r.totalTax).toBe(0);
    expect(r.effectiveRatePercent).toBe(0);
    expect(r.breakdown).toEqual([
      { from: 0, to: 100_000, ratePercent: 0, taxable: 80_000, tax: 0 },
    ]);
  });
});

describe('DEFAULT_SDLT_CONFIG (operator-configurable starting point)', () => {
  it('carries ordered bands and a last-updated date (FR-W-3/4)', () => {
    expect(DEFAULT_SDLT_CONFIG.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(DEFAULT_SDLT_CONFIG.standardBands.length).toBeGreaterThan(1);
    expect(DEFAULT_SDLT_CONFIG.standardBands.at(-1)?.upTo).toBeNull(); // open-ended top band
  });

  it('computes a non-negative, sensible result for a typical price', () => {
    const r = computeStampDuty(
      { purchasePrice: 500_000, buyerCategory: 'home_mover' },
      DEFAULT_SDLT_CONFIG,
    );
    expect(r.totalTax).toBeGreaterThanOrEqual(0);
    expect(r.effectiveRatePercent).toBeGreaterThanOrEqual(0);
    expect(r.effectiveRatePercent).toBeLessThan(100);
  });
});
