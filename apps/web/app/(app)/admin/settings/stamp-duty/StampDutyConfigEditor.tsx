'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, FormError, FormSuccess, NumberField, TextField } from '@estate/ui';

import type { SdltBand, SdltConfig } from '../../../lib/stamp-duty.js';
import { saveSdltConfig, type SdltConfigActionState } from './actions.js';

// EPIC-W FR-W-3 — the SDLT band-config editor. Loads the tenant's current config
// (or the engine default) and lets an admin edit each band's rate, the additional-
// property surcharge, the first-time-buyer relief, and the last-updated date. Band
// ceilings (`upTo`) are shown as read-only context — V1 edits rates + the date, the
// shape the calculator most needs to track HMRC changes; ceiling editing is a later
// refinement. On submit it serialises the config to JSON in a hidden field and
// posts to the audited saveSdltConfig action; the schema validates server-side.

const INITIAL_STATE: SdltConfigActionState = { ok: false };

const gbpWhole = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
});

/** "£from–£to" / "£from+" for the open-ended top band, given the previous ceiling. */
function bandRange(from: number, to: number | null): string {
  return to === null
    ? `${gbpWhole.format(from)}+`
    : `${gbpWhole.format(from)}–${gbpWhole.format(to)}`;
}

/** A controlled rate value per band, keyed by `<set>-<index>`. */
type RateState = Record<string, string>;

function ratesFor(config: SdltConfig): RateState {
  const rates: RateState = {};
  config.standardBands.forEach((band, index) => {
    rates[`standard-${index}`] = String(band.ratePercent);
  });
  config.firstTimeBuyer.bands.forEach((band, index) => {
    rates[`ftb-${index}`] = String(band.ratePercent);
  });
  return rates;
}

/** Rebuild a band list from the edited rates, preserving each band's ceiling. */
function rebuildBands(bands: SdltBand[], rates: RateState, prefix: string): SdltBand[] {
  return bands.map((band, index) => ({
    upTo: band.upTo,
    ratePercent: Number(rates[`${prefix}-${index}`] ?? band.ratePercent),
  }));
}

export function StampDutyConfigEditor({ config }: { config: SdltConfig }) {
  const [state, formAction, pending] = useActionState(saveSdltConfig, INITIAL_STATE);
  const [rates, setRates] = useState<RateState>(() => ratesFor(config));
  const [surcharge, setSurcharge] = useState(String(config.additionalPropertySurchargePercent));
  const [ftbMaxPrice, setFtbMaxPrice] = useState(String(config.firstTimeBuyer.maxPrice));
  const [lastUpdated, setLastUpdated] = useState(config.lastUpdated);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state, router]);

  const setRate = (key: string, value: string): void => {
    setRates((current) => ({ ...current, [key]: value }));
  };

  // The config object posted to the action — rebuilt from the edited fields.
  const serialised = useMemo(() => {
    const next: SdltConfig = {
      standardBands: rebuildBands(config.standardBands, rates, 'standard'),
      firstTimeBuyer: {
        maxPrice: Number(ftbMaxPrice),
        bands: rebuildBands(config.firstTimeBuyer.bands, rates, 'ftb'),
      },
      additionalPropertySurchargePercent: Number(surcharge),
      lastUpdated,
    };
    return JSON.stringify(next);
  }, [config, rates, surcharge, ftbMaxPrice, lastUpdated]);

  let standardFrom = 0;
  let ftbFrom = 0;

  return (
    <form action={formAction} className="flex max-w-[40rem] flex-col gap-8">
      <input type="hidden" name="config" value={serialised} />
      <FormError errors={state.errors ?? []} />
      {state.ok ? <FormSuccess title="Stamp duty bands saved." /> : null}

      <fieldset className="flex flex-col gap-4">
        <legend className="t-body-md font-semibold">Standard bands (home mover)</legend>
        {config.standardBands.map((band, index) => {
          const from = standardFrom;
          standardFrom = band.upTo ?? standardFrom;
          return (
            <div key={`standard-${index}`} className="flex items-end gap-4">
              <span className="t-body-sm text-text-secondary min-w-[14rem]">
                {bandRange(from, band.upTo)}
              </span>
              <NumberField
                id={`standard-rate-${index}`}
                label={`Rate for ${bandRange(from, band.upTo)} (%)`}
                inputMode="decimal"
                value={rates[`standard-${index}`] ?? ''}
                onChange={(event) => setRate(`standard-${index}`, event.target.value)}
              />
            </div>
          );
        })}
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="t-body-md font-semibold">First-time buyer relief</legend>
        <NumberField
          id="ftb-max-price"
          label="Relief applies up to (£)"
          inputMode="numeric"
          value={ftbMaxPrice}
          onChange={(event) => setFtbMaxPrice(event.target.value)}
        />
        {config.firstTimeBuyer.bands.map((band, index) => {
          const from = ftbFrom;
          ftbFrom = band.upTo ?? ftbFrom;
          return (
            <div key={`ftb-${index}`} className="flex items-end gap-4">
              <span className="t-body-sm text-text-secondary min-w-[14rem]">
                {bandRange(from, band.upTo)}
              </span>
              <NumberField
                id={`ftb-rate-${index}`}
                label={`First-time buyer rate for ${bandRange(from, band.upTo)} (%)`}
                inputMode="decimal"
                value={rates[`ftb-${index}`] ?? ''}
                onChange={(event) => setRate(`ftb-${index}`, event.target.value)}
              />
            </div>
          );
        })}
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="t-body-md font-semibold">Additional property</legend>
        <NumberField
          id="additional-surcharge"
          label="Additional-property surcharge (%)"
          hint="Added to every band's rate for an additional-property purchase."
          inputMode="decimal"
          value={surcharge}
          onChange={(event) => setSurcharge(event.target.value)}
        />
      </fieldset>

      <TextField
        id="last-updated"
        label="Bands last updated (YYYY-MM-DD)"
        hint="Shown alongside the calculator result."
        value={lastUpdated}
        onChange={(event) => setLastUpdated(event.target.value)}
      />

      <div>
        <Button type="submit" loading={pending}>
          Save bands
        </Button>
      </div>
    </form>
  );
}
