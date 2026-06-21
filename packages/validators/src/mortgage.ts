import { z } from 'zod';

// EPIC-W FR-W-5 — the indicative mortgage calculator's input schema. Shared
// between the client form (React Hook Form + zodResolver) and any server use. It
// is INDICATIVE ONLY (PRODUCT.md §9 — not financial advice) and captures NO
// personal data (FR-W-11), so it carries no consent affirmation. Inputs are
// `z.coerce.number()` so raw string values from `<input type="number">` parse.

export const mortgageInputSchema = z
  .object({
    /** Purchase price in whole pounds (GBP). */
    purchasePrice: z.coerce.number().positive().max(100_000_000),
    /** Cash deposit in whole pounds (GBP). */
    deposit: z.coerce.number().min(0),
    /** Annual interest rate as a percentage (e.g. 4.5 for 4.5%). */
    annualRatePercent: z.coerce.number().min(0).max(100),
    /** Mortgage term in whole years. */
    termYears: z.coerce.number().int().positive().max(40),
  })
  .refine((data) => data.deposit <= data.purchasePrice, {
    message: 'Deposit cannot exceed the purchase price',
    path: ['deposit'],
  });

/** A validated indicative-mortgage input. */
export type MortgageInput = z.infer<typeof mortgageInputSchema>;
