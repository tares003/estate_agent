'use client';

import { useState } from 'react';
import { NumberField, Select } from '@estate/ui';
import { stampDutyInputSchema, type SdltBuyerCategory } from '@estate/validators';

import { computeStampDuty, DEFAULT_SDLT_CONFIG } from '../../../lib/stamp-duty.js';

// EPIC-W FR-W-2/4 — the indicative Stamp Duty (SDLT) calculator UI. Computes live
// from DEFAULT_SDLT_CONFIG (an illustrative, operator-configurable band set —
// FR-W-3). INDICATIVE ONLY (PRODUCT.md §9); the "not financial advice" disclosure
// (FR-W-10) and the bands' last-updated date (FR-W-4) sit with the result.

const gbp = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 2,
});
const gbpWhole = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
});

const BUYER_OPTIONS: { value: SdltBuyerCategory; label: string }[] = [
  { value: 'first_time_buyer', label: 'First-time buyer' },
  { value: 'home_mover', label: 'Home mover' },
  { value: 'additional_property', label: 'Additional property' },
];

/** Format a band's range as "£from–£to" (or "£from+" for the open-ended top band). */
function bandRange(from: number, to: number | null): string {
  return to == null ? `${gbpWhole.format(from)}+` : `${gbpWhole.format(from)}–${gbpWhole.format(to)}`;
}

export function StampDutyCalculator() {
  const [purchasePrice, setPurchasePrice] = useState('300000');
  const [buyerCategory, setBuyerCategory] = useState<SdltBuyerCategory>('home_mover');

  const parsed = stampDutyInputSchema.safeParse({ purchasePrice, buyerCategory });
  const result = parsed.success ? computeStampDuty(parsed.data, DEFAULT_SDLT_CONFIG) : null;

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
      <form className="flex flex-col gap-5" noValidate aria-label="Stamp duty details">
        <NumberField
          id="purchasePrice"
          label="Purchase price (£)"
          inputMode="numeric"
          value={purchasePrice}
          onChange={(event) => setPurchasePrice(event.target.value)}
        />
        <Select
          id="buyerCategory"
          label="Buyer category"
          options={BUYER_OPTIONS}
          value={buyerCategory}
          onChange={(event) => setBuyerCategory(event.target.value as SdltBuyerCategory)}
        />
      </form>

      <div className="border-divider bg-surface-raised flex flex-col rounded-lg border p-6">
        {result ? (
          <>
            <p className="t-caption text-text-secondary">Indicative stamp duty</p>
            <p data-testid="total-tax" className="t-display-sm">
              {gbp.format(result.totalTax)}
            </p>
            <p className="t-body-sm text-text-secondary mt-1">
              Effective rate {result.effectiveRatePercent}%
            </p>

            {result.breakdown.length > 0 ? (
              <dl className="mt-6 flex flex-col gap-2">
                {result.breakdown.map((band) => (
                  <div
                    key={`${band.from}-${band.ratePercent}`}
                    data-testid="sdlt-band"
                    className="flex items-baseline justify-between gap-4"
                  >
                    <dt className="t-body-sm text-text-secondary">
                      {bandRange(band.from, band.to)} @ {band.ratePercent}%
                    </dt>
                    <dd className="t-body-md font-medium">{gbp.format(band.tax)}</dd>
                  </div>
                ))}
              </dl>
            ) : null}

            <p className="t-caption text-text-secondary mt-6">Last updated {result.lastUpdated}.</p>
          </>
        ) : (
          <p className="t-body-md text-text-secondary">
            Enter a purchase price to see the indicative stamp duty.
          </p>
        )}
        <p className="t-caption text-text-secondary mt-2">
          For guidance only — not financial advice. Verify against current HMRC rates.
        </p>
      </div>
    </div>
  );
}
