'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, FormError, Select } from '@estate/ui';

import { setRepairStatus, type RepairStatusState } from './actions.js';
import type { RepairStatusOption } from './next-statuses.js';

const INITIAL_STATE: RepairStatusState = { ok: false };

/**
 * EPIC-G repair triage (FR-G-6) — the status changer. A client component driven by
 * `useActionState(setRepairStatus, …)`: the select offers only the §G.5-legal next
 * statuses (computed server-side and passed in), the notes field feeds the
 * `repair_status_history` row (and is the required rejection reason when moving to
 * `rejected`). A terminal ticket renders a quiet explanation instead of a form.
 */
export function RepairStatusControl({
  repairId,
  options,
}: {
  repairId: string;
  options: readonly RepairStatusOption[];
}) {
  const [state, formAction, pending] = useActionState(setRepairStatus, INITIAL_STATE);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state, router]);

  if (options.length === 0) {
    return (
      <p className="t-body-sm text-text-secondary">
        This repair is in a final state and cannot move further.
      </p>
    );
  }

  const errorFor = (name: string) => state.errors?.find((error) => error.field === name)?.message;

  return (
    <form action={formAction} className="flex max-w-[28rem] flex-col gap-3">
      <FormError errors={state.errors ?? []} />
      <input type="hidden" name="repairId" value={repairId} />
      <Select
        id="to"
        name="to"
        label="Move to"
        placeholder="Choose a status…"
        options={options.map((option) => ({ value: option.value, label: option.label }))}
        error={errorFor('to')}
      />
      <label htmlFor="notes" className="flex flex-col gap-1">
        <span className="t-body-sm text-text-secondary">Notes</span>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          className="border-divider rounded-md border px-3 py-2"
          aria-describedby="notes-hint"
        />
        <span id="notes-hint" className="t-body-sm text-text-secondary">
          Recorded in the status history. Required when rejecting.
        </span>
      </label>
      {errorFor('notes') ? (
        <p role="alert" className="t-body-sm text-danger">
          {errorFor('notes')}
        </p>
      ) : null}
      <Button type="submit" variant="secondary" size="sm" loading={pending}>
        Update status
      </Button>
    </form>
  );
}
