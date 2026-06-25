'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, FormError, FormSuccess, NumberField, TextField } from '@estate/ui';

import type { MortgageRatePreset } from '../../../lib/mortgage-rate-presets.js';
import { saveMortgageRatePresets, type MortgageRatePresetActionState } from './presets-actions.js';

// EPIC-W FR-W-8 — the mortgage rate preset editor. Lists the tenant's curated rate
// snapshots and lets an admin add / edit / remove them. On submit it serialises the
// list to JSON in a hidden field and posts to the audited saveMortgageRatePresets
// action; the schema validates server-side. Indicative only (PRODUCT.md §9) — these
// presets are one-tap rate snapshots offered in the public calculator's dropdown.

const INITIAL_STATE: MortgageRatePresetActionState = { ok: false };

/** A locally-edited preset row (the persisted id is dropped when serialising). */
interface DraftPreset {
  /** A stable local key for React (the persisted id, or a fresh local id). */
  key: string;
  label: string;
  annualRatePercent: string;
  termYears: string;
}

let localCounter = 0;
function freshKey(): string {
  localCounter += 1;
  return `new-${localCounter}`;
}

function toDraft(preset: MortgageRatePreset): DraftPreset {
  return {
    key: preset.id,
    label: preset.label,
    annualRatePercent: String(preset.annualRatePercent),
    termYears: String(preset.termYears),
  };
}

export function MortgagePresetEditor({ presets }: { presets: MortgageRatePreset[] }) {
  const [state, formAction, pending] = useActionState(saveMortgageRatePresets, INITIAL_STATE);
  const [rows, setRows] = useState<DraftPreset[]>(() => presets.map(toDraft));
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state, router]);

  const serialised = useMemo(
    () =>
      JSON.stringify(
        rows.map((row) => ({
          label: row.label,
          annualRatePercent: Number(row.annualRatePercent),
          termYears: Number(row.termYears),
        })),
      ),
    [rows],
  );

  const update = (key: string, field: keyof Omit<DraftPreset, 'key'>, value: string) => {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    );
  };

  const addRow = () => {
    setRows((current) => [
      ...current,
      { key: freshKey(), label: '', annualRatePercent: '', termYears: '' },
    ]);
  };

  const removeRow = (key: string) => {
    setRows((current) => current.filter((row) => row.key !== key));
  };

  return (
    <form action={formAction} className="flex max-w-[48rem] flex-col gap-8">
      <input type="hidden" name="presets" value={serialised} />
      <FormError errors={state.errors ?? []} />
      {state.ok ? <FormSuccess title="Mortgage presets saved." /> : null}

      <ul className="flex flex-col gap-6">
        {rows.map((row, index) => (
          <li
            key={row.key}
            className="border-divider grid grid-cols-1 gap-4 rounded-lg border p-4 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end"
          >
            <TextField
              id={`preset-label-${row.key}`}
              label="Preset name"
              hint={index === 0 ? 'e.g. 2-year fixed' : undefined}
              value={row.label}
              onChange={(event) => update(row.key, 'label', event.target.value)}
            />
            <NumberField
              id={`preset-rate-${row.key}`}
              label="Rate (% per year)"
              step="0.01"
              inputMode="decimal"
              value={row.annualRatePercent}
              onChange={(event) => update(row.key, 'annualRatePercent', event.target.value)}
            />
            <NumberField
              id={`preset-term-${row.key}`}
              label="Term (years)"
              inputMode="numeric"
              value={row.termYears}
              onChange={(event) => update(row.key, 'termYears', event.target.value)}
            />
            <Button
              type="button"
              variant="ghost"
              onClick={() => removeRow(row.key)}
              aria-label={`Remove preset ${row.label || index + 1}`}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>

      <div className="flex gap-3">
        <Button type="button" variant="secondary" onClick={addRow}>
          Add preset
        </Button>
        <Button type="submit" loading={pending}>
          Save presets
        </Button>
      </div>
    </form>
  );
}
