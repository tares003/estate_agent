'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, FormError, Select } from '@estate/ui';

import type { PropertyChoice } from '../../../lib/property-choices.js';
import { setRepairProperty, type RepairMatchState } from './link-property-actions.js';

const INITIAL_STATE: RepairMatchState = { ok: false };

/**
 * EPIC-G repair triage (§G.6) — the property-match control. A client component
 * driven by `useActionState(setRepairProperty, …)`: a select of the tenant's live
 * listings (server-fetched and passed in), pre-set to the current match, with a
 * "Not matched" empty choice to unmatch.
 */
export function PropertyMatchControl({
  repairId,
  current,
  choices,
}: {
  repairId: string;
  current: string | null;
  choices: readonly PropertyChoice[];
}) {
  const [state, formAction, pending] = useActionState(setRepairProperty, INITIAL_STATE);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={formAction} className="flex max-w-[28rem] flex-col gap-3">
      <FormError errors={state.errors ?? []} />
      <input type="hidden" name="repairId" value={repairId} />
      <Select
        id="propertyId"
        name="propertyId"
        label="Matched property"
        defaultValue={current ?? ''}
      >
        <option value="">Not matched</option>
        {choices.map((choice) => (
          <option key={choice.id} value={choice.id}>
            {choice.displayAddress}
          </option>
        ))}
      </Select>
      <Button type="submit" variant="secondary" size="sm" loading={pending}>
        Save match
      </Button>
    </form>
  );
}
