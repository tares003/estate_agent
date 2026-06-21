import type { StampDutyInput } from '@estate/validators';

// EPIC-W FR-W-2/4 — the indicative Stamp Duty (SDLT) engine (pure, no React/DB).
// INDICATIVE ONLY (PRODUCT.md §9 — not financial/tax advice); the UI renders the
// "For guidance only" disclosure adjacent to the result (FR-W-10).
//
// The bands are CONFIGURATION (FR-W-3): they are admin-editable so thresholds can
// track HMRC changes without a redeploy. DEFAULT_SDLT_CONFIG below is an
// illustrative England/NI starting point — the operator MUST verify it against the
// current rates and configure per their region (Wales LTT / Scotland LBTT via the
// same shape). The progressive-band maths is the tested invariant; the specific
// rates are data.

/** One SDLT band: the rate that applies to the slice of price up to `upTo`
 *  (exclusive of the previous band's ceiling). `upTo: null` is the open-ended top
 *  band. Bands must be ordered ascending and the last must be open-ended. */
export interface SdltBand {
  upTo: number | null;
  ratePercent: number;
}

/** Admin-editable SDLT configuration (FR-W-3). */
export interface SdltConfig {
  /** Standard residential bands (home mover). */
  standardBands: SdltBand[];
  /** First-time-buyer relief: its own bands, applied only up to `maxPrice`. */
  firstTimeBuyer: { maxPrice: number; bands: SdltBand[] };
  /** Surcharge added to EVERY band's rate for an additional property. */
  additionalPropertySurchargePercent: number;
  /** ISO date the bands were last configured (shown with the result, FR-W-4). */
  lastUpdated: string;
}

/** One row of the per-band breakdown (FR-W-4). */
export interface SdltBandBreakdown {
  from: number;
  to: number | null;
  ratePercent: number;
  taxable: number;
  tax: number;
}

/** The computed indicative stamp-duty result (money in GBP, rounded to the penny). */
export interface StampDutyResult {
  totalTax: number;
  effectiveRatePercent: number;
  breakdown: SdltBandBreakdown[];
  lastUpdated: string;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Pick the band set + per-band rate adjustment for the buyer category. */
function bandsFor(input: StampDutyInput, config: SdltConfig): { bands: SdltBand[]; surcharge: number } {
  if (input.buyerCategory === 'first_time_buyer' && input.purchasePrice <= config.firstTimeBuyer.maxPrice) {
    return { bands: config.firstTimeBuyer.bands, surcharge: 0 };
  }
  const surcharge =
    input.buyerCategory === 'additional_property' ? config.additionalPropertySurchargePercent : 0;
  return { bands: config.standardBands, surcharge };
}

/**
 * Compute indicative SDLT for a purchase, applying the configured bands
 * progressively (each band taxes only the slice of price that falls within it).
 * Returns the total, the effective rate, and the per-band breakdown (only the
 * bands the price actually reaches), plus the config's last-updated date.
 */
export function computeStampDuty(input: StampDutyInput, config: SdltConfig): StampDutyResult {
  const { bands, surcharge } = bandsFor(input, config);
  const price = input.purchasePrice;

  let lowerBound = 0;
  let totalTax = 0;
  const breakdown: SdltBandBreakdown[] = [];

  for (const band of bands) {
    const ceiling = band.upTo ?? Infinity;
    const taxable = Math.max(0, Math.min(price, ceiling) - lowerBound);
    if (taxable > 0) {
      const ratePercent = band.ratePercent + surcharge;
      const tax = round2((taxable * ratePercent) / 100);
      breakdown.push({ from: lowerBound, to: band.upTo, ratePercent, taxable, tax });
      totalTax += tax;
    }
    lowerBound = ceiling;
    if (price <= ceiling) break;
  }

  totalTax = round2(totalTax);
  return {
    totalTax,
    effectiveRatePercent: price > 0 ? round2((totalTax / price) * 100) : 0,
    breakdown,
    lastUpdated: config.lastUpdated,
  };
}

/**
 * Illustrative England + Northern Ireland residential defaults (FR-W-2). NOT
 * authoritative — the operator MUST verify against current HMRC rates and edit
 * via the admin (FR-W-3); these exist so the calculator works out of the box.
 */
export const DEFAULT_SDLT_CONFIG: SdltConfig = {
  standardBands: [
    { upTo: 250_000, ratePercent: 0 },
    { upTo: 925_000, ratePercent: 5 },
    { upTo: 1_500_000, ratePercent: 10 },
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
