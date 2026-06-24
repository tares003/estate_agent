import { z } from 'zod';

// EPIC-W FR-W-8 — the admin-managed mortgage rate preset schema. A preset is a named
// rate snapshot (e.g. "2-year fixed", "5-year fixed") an admin curates so a visitor
// can one-tap-apply it in the public calculator's preset dropdown. The schema is the
// single gate between the admin editor and persistence. INDICATIVE ONLY (PRODUCT.md
// §9 — not financial advice) and captures NO personal data (configuration), so it
// carries no GDPR-consent affirmation.
//
// Ranges mirror the public mortgageInputSchema: rate is a percentage in [0, 100];
// term is a whole number of years in [1, 40].

/** Maximum length of a preset's display label (keeps the dropdown legible). */
export const MORTGAGE_PRESET_LABEL_MAX = 60;

/** A single validated preset, as stored and as offered in the dropdown. */
export const mortgageRatePresetSchema = z.object({
  /** Display label shown in the dropdown (e.g. "2-year fixed"). */
  label: z.string().trim().min(1, 'Give the preset a name.').max(MORTGAGE_PRESET_LABEL_MAX),
  /** Illustrative annual interest rate as a percentage (e.g. 4.79 for 4.79%). */
  annualRatePercent: z.number().min(0).max(100),
  /** The preset's mortgage term in whole years. */
  termYears: z.number().int().positive().max(40),
});

/**
 * The same shape with coercion, for the admin form (raw string inputs from
 * `<input type="number">` parse to numbers).
 */
export const mortgageRatePresetCreateSchema = z.object({
  label: z.string().trim().min(1, 'Give the preset a name.').max(MORTGAGE_PRESET_LABEL_MAX),
  annualRatePercent: z.coerce.number().min(0).max(100),
  termYears: z.coerce.number().int().positive().max(40),
});

/** The validated full preset list an admin saves (replaces the tenant's list). */
export const mortgageRatePresetListSchema = z.array(mortgageRatePresetCreateSchema).max(20);

/** A validated mortgage rate preset (structurally the engine's `MortgageRatePreset`). */
export type MortgageRatePresetInput = z.infer<typeof mortgageRatePresetSchema>;
