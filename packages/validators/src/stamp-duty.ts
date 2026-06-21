import { z } from 'zod';

// EPIC-W FR-W-1 — the indicative Stamp Duty (SDLT) calculator's input. Shared
// between the client form and any server use. INDICATIVE ONLY (PRODUCT.md §9 —
// not financial/tax advice) and captures NO personal data (FR-W-11), so no
// consent affirmation.

/** The buyer categories that drive which SDLT bands apply (FR-W-1). */
export const SDLT_BUYER_CATEGORIES = [
  'first_time_buyer',
  'home_mover',
  'additional_property',
] as const;

export const stampDutyInputSchema = z.object({
  /** Purchase price in whole pounds (GBP). */
  purchasePrice: z.coerce.number().positive().max(100_000_000),
  /** Buyer category — selects standard / first-time-buyer / additional-property rates. */
  buyerCategory: z.enum(SDLT_BUYER_CATEGORIES),
});

/** A buyer category (one of {@link SDLT_BUYER_CATEGORIES}). */
export type SdltBuyerCategory = (typeof SDLT_BUYER_CATEGORIES)[number];

/** A validated indicative stamp-duty input. */
export type StampDutyInput = z.infer<typeof stampDutyInputSchema>;
