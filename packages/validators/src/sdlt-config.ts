import { z } from 'zod';

// EPIC-W FR-W-3 — the admin-editable SDLT band-configuration schema. It validates
// the exact `SdltConfig` shape the indicative engine (computeStampDuty) consumes,
// so the admin editor and persistence share one source of truth with the maths.
// INDICATIVE ONLY (PRODUCT.md §9 — not financial/tax advice) and captures NO
// personal data (configuration), so it carries no GDPR-consent affirmation.
//
// Band invariants: a band's `upTo` is its ceiling (the last band is open-ended,
// `null`); bands are ordered by ascending ceiling and the final one must be
// open-ended so every price is covered. Rates are percentages in [0, 100].

/** One SDLT band: the rate for the slice of price up to `upTo` (`null` = open-ended top). */
const sdltBandSchema = z.object({
  upTo: z.number().positive().nullable(),
  ratePercent: z.number().min(0).max(100),
});

/**
 * A band set: at least one band, ascending finite ceilings, exactly one
 * open-ended (`null`) band and it must be last (so every price is covered).
 */
const sdltBandsSchema = z
  .array(sdltBandSchema)
  .min(1)
  .superRefine((bands, ctx) => {
    const lastBand = bands.at(-1);
    if (!lastBand || lastBand.upTo !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'The final band must be open-ended (upTo: null).',
      });
    }
    // Only the final band may be open-ended.
    for (let index = 0; index < bands.length - 1; index += 1) {
      if (bands[index]!.upTo === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Only the final band may be open-ended.',
        });
      }
    }
    // Finite ceilings must be strictly ascending.
    const ceilings = bands
      .map((band) => band.upTo)
      .filter((upTo): upTo is number => upTo !== null);
    for (let index = 1; index < ceilings.length; index += 1) {
      if (ceilings[index]! <= ceilings[index - 1]!) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Band ceilings must be in ascending order.',
        });
        break;
      }
    }
  });

export const sdltConfigSchema = z.object({
  /** Standard residential bands (home mover). */
  standardBands: sdltBandsSchema,
  /** First-time-buyer relief: its own bands, applied only up to `maxPrice`. */
  firstTimeBuyer: z.object({
    maxPrice: z.number().positive(),
    bands: sdltBandsSchema,
  }),
  /** Surcharge added to every band's rate for an additional property. */
  additionalPropertySurchargePercent: z.number().min(0).max(100),
  /** ISO date (YYYY-MM-DD) the bands were last configured (shown with the result, FR-W-4). */
  lastUpdated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use an ISO date (YYYY-MM-DD).'),
});

/** A validated SDLT band configuration (structurally the engine's `SdltConfig`). */
export type SdltConfigInput = z.infer<typeof sdltConfigSchema>;
