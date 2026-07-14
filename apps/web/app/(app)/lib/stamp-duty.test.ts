import { describe, expect, it } from 'vitest';

import { DEFAULT_SDLT_CONFIG, computeStampDuty, type SdltConfig } from './stamp-duty.js';

// EPIC-W FR-W-2/4 — the indicative SDLT engine. The BAND-APPLICATION logic is
// proven against SYNTHETIC bands (the progressive maths is the invariant; the
// rates are admin-configurable data per FR-W-3). The shipped DEFAULT_SDLT_CONFIG
// is additionally PINNED to the England/NI rules in force since 2025-04-01
// (audit finding stale-default-sdlt-bands): a fresh tenant that has not
// configured custom bands must get an accurate out-of-the-box calculator, not
// the pre-April-2025 figures. The defaults remain illustrative/operator-must-
// verify — pinning them here means a rate refresh is a deliberate, tested edit.

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
    const r = computeStampDuty(
      { purchasePrice: 250_000, buyerCategory: 'first_time_buyer' },
      CONFIG,
    );
    // FTB: 0% of 150k + 5% of 100k = 5000.
    expect(r.totalTax).toBe(5000);
  });

  it('falls back to standard bands when a first-time buyer exceeds the relief cap', () => {
    const r = computeStampDuty(
      { purchasePrice: 400_000, buyerCategory: 'first_time_buyer' },
      CONFIG,
    );
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

  it('ships the England/NI main residential bands in force since 2025-04-01 (FR-W-2)', () => {
    expect(DEFAULT_SDLT_CONFIG.standardBands).toEqual([
      { upTo: 125_000, ratePercent: 0 },
      { upTo: 250_000, ratePercent: 2 },
      { upTo: 925_000, ratePercent: 5 },
      { upTo: 1_500_000, ratePercent: 10 },
      { upTo: null, ratePercent: 12 },
    ]);
  });

  it('ships the first-time-buyer relief at a 300k nil-rate band under a 500k cap (FR-W-2)', () => {
    expect(DEFAULT_SDLT_CONFIG.firstTimeBuyer).toEqual({
      maxPrice: 500_000,
      bands: [
        { upTo: 300_000, ratePercent: 0 },
        { upTo: null, ratePercent: 5 },
      ],
    });
  });

  it('ships the 5% additional-property surcharge and the 2025-04-01 effective date', () => {
    expect(DEFAULT_SDLT_CONFIG.additionalPropertySurchargePercent).toBe(5);
    expect(DEFAULT_SDLT_CONFIG.lastUpdated).toBe('2025-04-01');
  });

  it('charges a 300k home mover 5,000 out of the box (the restored 2% band applies)', () => {
    // 0% of 125k + 2% of 125k (2,500) + 5% of 50k (2,500) = 5,000 — the audit
    // finding's example: the stale defaults understated this as ~2,500.
    const r = computeStampDuty(
      { purchasePrice: 300_000, buyerCategory: 'home_mover' },
      DEFAULT_SDLT_CONFIG,
    );
    expect(r.totalTax).toBe(5000);
    expect(r.lastUpdated).toBe('2025-04-01');
  });

  it('charges a 425k first-time buyer 6,250 out of the box (relief up to the 500k cap)', () => {
    // FTB bands apply (425k <= 500k cap): 0% of 300k + 5% of 125k = 6,250.
    const r = computeStampDuty(
      { purchasePrice: 425_000, buyerCategory: 'first_time_buyer' },
      DEFAULT_SDLT_CONFIG,
    );
    expect(r.totalTax).toBe(6250);
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
