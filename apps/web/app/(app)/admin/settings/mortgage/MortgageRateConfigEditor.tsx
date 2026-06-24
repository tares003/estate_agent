'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, FormError, FormSuccess, NumberField, TextField } from '@estate/ui';

import type { MortgageRateConfig } from '../../../lib/mortgage.js';
import { saveMortgageRateConfig, type MortgageRateConfigActionState } from './actions.js';

// EPIC-W FR-W-7 — the mortgage-default config editor. Loads the tenant's current
// defaults (or the engine default) and lets an admin edit the illustrative annual
// rate, the default term, the default deposit percentage, and the last-reviewed date.
// On submit it serialises the config to JSON in a hidden field and posts to the
// audited saveMortgageRateConfig action; the schema validates server-side. Indicative
// only (PRODUCT.md §9) — these defaults pre-fill the public calculator's fields.

const INITIAL_STATE: MortgageRateConfigActionState = { ok: false };

export function MortgageRateConfigEditor({ config }: { config: MortgageRateConfig }) {
  const [state, formAction, pending] = useActionState(saveMortgageRateConfig, INITIAL_STATE);
  const [annualRatePercent, setAnnualRatePercent] = useState(
    String(config.defaultAnnualRatePercent),
  );
  const [termYears, setTermYears] = useState(String(config.defaultTermYears));
  const [depositPercent, setDepositPercent] = useState(String(config.defaultDepositPercent));
  const [lastReviewed, setLastReviewed] = useState(config.lastReviewed);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state, router]);

  // The config object posted to the action — rebuilt from the edited fields.
  const serialised = useMemo(() => {
    const next: MortgageRateConfig = {
      defaultAnnualRatePercent: Number(annualRatePercent),
      defaultTermYears: Number(termYears),
      defaultDepositPercent: Number(depositPercent),
      lastReviewed,
    };
    return JSON.stringify(next);
  }, [annualRatePercent, termYears, depositPercent, lastReviewed]);

  return (
    <form action={formAction} className="flex max-w-[40rem] flex-col gap-8">
      <input type="hidden" name="config" value={serialised} />
      <FormError errors={state.errors ?? []} />
      {state.ok ? <FormSuccess title="Mortgage defaults saved." /> : null}

      <fieldset className="flex flex-col gap-4">
        <legend className="t-body-md font-semibold">Calculator defaults</legend>
        <NumberField
          id="default-rate"
          label="Default interest rate (% per year)"
          hint="Pre-fills the public calculator's rate field. Indicative only."
          step="0.1"
          inputMode="decimal"
          value={annualRatePercent}
          onChange={(event) => setAnnualRatePercent(event.target.value)}
        />
        <NumberField
          id="default-term"
          label="Default term (years)"
          inputMode="numeric"
          value={termYears}
          onChange={(event) => setTermYears(event.target.value)}
        />
        <NumberField
          id="default-deposit"
          label="Default deposit (% of price)"
          inputMode="decimal"
          value={depositPercent}
          onChange={(event) => setDepositPercent(event.target.value)}
        />
      </fieldset>

      <TextField
        id="last-reviewed"
        label="Guidance last reviewed (YYYY-MM-DD)"
        hint="Shown alongside the calculator result."
        value={lastReviewed}
        onChange={(event) => setLastReviewed(event.target.value)}
      />

      <div>
        <Button type="submit" loading={pending}>
          Save defaults
        </Button>
      </div>
    </form>
  );
}
