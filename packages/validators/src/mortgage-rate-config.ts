import { z } from 'zod';

// EPIC-W FR-W-7 — the admin-editable mortgage-default configuration schema. It
// validates the defaults the public mortgage calculator pre-fills: the illustrative
// annual interest rate, the default term (whole years), the default deposit
// percentage, and the ISO date the guidance was last reviewed. The schema is the
// single gate between the admin editor and persistence, so the editor and the maths
// share one source of truth. INDICATIVE ONLY (PRODUCT.md §9 — not financial advice)
// and captures NO personal data (configuration), so it carries no GDPR-consent
// affirmation.
//
// Ranges mirror the public mortgageInputSchema: rate is a percentage in [0, 100],
// term is a whole number of years in [1, 40], deposit is a percentage in [0, 100].

export const mortgageRateConfigSchema = z.object({
  /** Illustrative annual interest rate as a percentage (e.g. 4.5 for 4.5%). */
  defaultAnnualRatePercent: z.number().min(0).max(100),
  /** Default mortgage term in whole years. */
  defaultTermYears: z.number().int().positive().max(40),
  /** Default deposit as a percentage of the purchase price. */
  defaultDepositPercent: z.number().min(0).max(100),
  /** ISO date (YYYY-MM-DD) the rate guidance was last reviewed (shown with the calculator). */
  lastReviewed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use an ISO date (YYYY-MM-DD).'),
});

/** A validated mortgage-default configuration (structurally the engine's `MortgageRateConfig`). */
export type MortgageRateConfigInput = z.infer<typeof mortgageRateConfigSchema>;
