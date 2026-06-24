'use client';

import { useState } from 'react';
import { NumberField } from '@estate/ui';
import { mortgageInputSchema } from '@estate/validators';

import {
  DEFAULT_MORTGAGE_RATE_CONFIG,
  computeMortgage,
  type MortgageRateConfig,
} from '../../../lib/mortgage.js';
import { PrintButton } from '../PrintButton.js';

// EPIC-W FR-W-6/7 — the indicative mortgage calculator UI. Computes live from the
// inputs (no server round-trip): every change re-parses through
// `mortgageInputSchema` and, when valid, runs `computeMortgage`. INDICATIVE ONLY
// (PRODUCT.md §9) — the "not financial advice" disclosure (FR-W-10 / PRODUCT.md §8)
// sits adjacent to the result. The maths + schema are unit-tested in their own
// modules; this composes them with the design-system field + typography tokens.
//
// FR-W-7: the optional `config` prop carries the tenant's admin-configured defaults
// (rate / term / deposit %) that seed the fields' initial values; it defaults to the
// engine default so the component renders standalone (and keeps existing tests green).

/** The calculator's own default purchase price (UX seed; the config has no price). */
const DEFAULT_PURCHASE_PRICE = 300_000;

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

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="t-body-sm text-text-secondary">{label}</dt>
      <dd className="t-body-md font-medium">{value}</dd>
    </div>
  );
}

export function MortgageCalculator({
  config = DEFAULT_MORTGAGE_RATE_CONFIG,
}: {
  config?: MortgageRateConfig;
}) {
  const initialDeposit = Math.round(
    (DEFAULT_PURCHASE_PRICE * config.defaultDepositPercent) / 100,
  );
  const [purchasePrice, setPurchasePrice] = useState(String(DEFAULT_PURCHASE_PRICE));
  const [deposit, setDeposit] = useState(String(initialDeposit));
  const [annualRatePercent, setAnnualRatePercent] = useState(
    String(config.defaultAnnualRatePercent),
  );
  const [termYears, setTermYears] = useState(String(config.defaultTermYears));

  const parsed = mortgageInputSchema.safeParse({
    purchasePrice,
    deposit,
    annualRatePercent,
    termYears,
  });
  const result = parsed.success ? computeMortgage(parsed.data) : null;

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
      <form className="flex flex-col gap-5" noValidate aria-label="Mortgage details">
        <NumberField
          id="purchasePrice"
          label="Purchase price (£)"
          inputMode="numeric"
          value={purchasePrice}
          onChange={(event) => setPurchasePrice(event.target.value)}
        />
        <NumberField
          id="deposit"
          label="Deposit (£)"
          inputMode="numeric"
          value={deposit}
          onChange={(event) => setDeposit(event.target.value)}
        />
        <NumberField
          id="annualRatePercent"
          label="Interest rate (% per year)"
          step="0.1"
          value={annualRatePercent}
          onChange={(event) => setAnnualRatePercent(event.target.value)}
        />
        <NumberField
          id="termYears"
          label="Term (years)"
          value={termYears}
          onChange={(event) => setTermYears(event.target.value)}
        />
      </form>

      <div className="border-divider bg-surface-raised flex flex-col rounded-lg border p-6">
        {result ? (
          <>
            <p className="t-caption text-text-secondary">Indicative monthly repayment</p>
            <p data-testid="monthly-repayment" className="t-display-sm">
              {gbp.format(result.monthlyRepayment)}
            </p>
            <dl className="mt-6 flex flex-col gap-3">
              <ResultRow label="Loan amount" value={gbpWhole.format(result.loanAmount)} />
              <ResultRow label="Loan-to-value" value={`${result.ltvPercent}%`} />
              <ResultRow label="Total interest" value={gbp.format(result.totalInterest)} />
              <ResultRow label="Total payable" value={gbp.format(result.totalPayable)} />
            </dl>
            <div className="mt-6">
              <PrintButton />
            </div>
          </>
        ) : (
          <p className="t-body-md text-text-secondary">
            Enter your details to see an indicative repayment.
          </p>
        )}
        <p className="t-caption text-text-secondary mt-6">
          For guidance only — not financial advice.
        </p>
      </div>
    </div>
  );
}
