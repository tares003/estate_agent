import { describe, expect, it } from 'vitest';

import { sdltConfigSchema, type SdltConfigInput } from './sdlt-config.js';

// EPIC-W FR-W-3 — the admin-editable SDLT band-configuration schema. Validates the
// exact `SdltConfig` shape that the indicative engine (computeStampDuty) consumes:
// standard + first-time-buyer bands ({ upTo: number|null, ratePercent }), an
// additional-property surcharge, and a last-updated ISO date. The schema is the
// gate between the admin editor and persistence, so it rejects malformed input
// (negative rates, an unordered / non-open-ended band set). Captures NO personal
// data (configuration only), so no GDPR consent affirmation.

const GOOD: SdltConfigInput = {
  standardBands: [
    { upTo: 250_000, ratePercent: 0 },
    { upTo: 925_000, ratePercent: 5 },
    { upTo: null, ratePercent: 12 },
  ],
  firstTimeBuyer: {
    maxPrice: 625_000,
    bands: [
      { upTo: 425_000, ratePercent: 0 },
      { upTo: null, ratePercent: 5 },
    ],
  },
  additionalPropertySurchargePercent: 3,
  lastUpdated: '2024-04-01',
};

describe('sdltConfigSchema', () => {
  it('accepts a well-formed config', () => {
    const result = sdltConfigSchema.safeParse(GOOD);
    expect(result.success).toBe(true);
  });

  it('rejects a negative rate', () => {
    const result = sdltConfigSchema.safeParse({
      ...GOOD,
      standardBands: [
        { upTo: 250_000, ratePercent: -1 },
        { upTo: null, ratePercent: 5 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a rate above 100%', () => {
    const result = sdltConfigSchema.safeParse({
      ...GOOD,
      standardBands: [
        { upTo: 250_000, ratePercent: 0 },
        { upTo: null, ratePercent: 101 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a negative band ceiling', () => {
    const result = sdltConfigSchema.safeParse({
      ...GOOD,
      standardBands: [
        { upTo: -5, ratePercent: 0 },
        { upTo: null, ratePercent: 5 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty band set', () => {
    const result = sdltConfigSchema.safeParse({ ...GOOD, standardBands: [] });
    expect(result.success).toBe(false);
  });

  it('rejects a band set whose final band is not open-ended', () => {
    const result = sdltConfigSchema.safeParse({
      ...GOOD,
      standardBands: [
        { upTo: 250_000, ratePercent: 0 },
        { upTo: 925_000, ratePercent: 5 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects unordered (non-ascending) band ceilings', () => {
    const result = sdltConfigSchema.safeParse({
      ...GOOD,
      standardBands: [
        { upTo: 925_000, ratePercent: 5 },
        { upTo: 250_000, ratePercent: 0 },
        { upTo: null, ratePercent: 12 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-open-ended first-time-buyer band set', () => {
    const result = sdltConfigSchema.safeParse({
      ...GOOD,
      firstTimeBuyer: {
        maxPrice: 625_000,
        bands: [{ upTo: 425_000, ratePercent: 0 }],
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects a negative additional-property surcharge', () => {
    const result = sdltConfigSchema.safeParse({ ...GOOD, additionalPropertySurchargePercent: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed lastUpdated date', () => {
    const result = sdltConfigSchema.safeParse({ ...GOOD, lastUpdated: '01/04/2024' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing lastUpdated', () => {
    const { lastUpdated: _omit, ...withoutDate } = GOOD;
    const result = sdltConfigSchema.safeParse(withoutDate);
    expect(result.success).toBe(false);
  });
});
