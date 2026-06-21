import { describe, expect, it } from 'vitest';

import { SDLT_BUYER_CATEGORIES, stampDutyInputSchema } from './stamp-duty.js';

// EPIC-W FR-W-1 — the indicative Stamp Duty calculator's input: a purchase price
// and a buyer category. Pure numeric/enum form; captures NO personal data
// (FR-W-11), so no consent affirmation.

describe('stampDutyInputSchema', () => {
  it('lists the three buyer categories (FR-W-1)', () => {
    expect(SDLT_BUYER_CATEGORIES).toEqual([
      'first_time_buyer',
      'home_mover',
      'additional_property',
    ]);
  });

  it('accepts a valid purchase price + buyer category', () => {
    const parsed = stampDutyInputSchema.parse({ purchasePrice: 450_000, buyerCategory: 'home_mover' });
    expect(parsed).toEqual({ purchasePrice: 450_000, buyerCategory: 'home_mover' });
  });

  it('coerces a numeric-string price from the form input', () => {
    expect(stampDutyInputSchema.parse({ purchasePrice: '450000', buyerCategory: 'home_mover' })
      .purchasePrice).toBe(450_000);
  });

  it('rejects a non-positive price and an unknown buyer category', () => {
    expect(stampDutyInputSchema.safeParse({ purchasePrice: 0, buyerCategory: 'home_mover' }).success).toBe(
      false,
    );
    expect(
      stampDutyInputSchema.safeParse({ purchasePrice: 450_000, buyerCategory: 'investor' }).success,
    ).toBe(false);
  });
});
