'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, FormError } from '@estate/ui';
import type { MarketStatus } from '@estate/validators';

import { setPropertyMarketStatus, type MarketStatusState } from './market-status-actions.js';
import { marketStatusLabel } from './market-status-display.js';

const INITIAL: MarketStatusState = { ok: false };

// EPIC-H property market-status control (FR-H-2). A client form: a select of the
// statuses relevant to the listing's sale type, pre-set to the current status. On
// success it refreshes the route so the header badge + the public catalogue reflect
// the change (and a PropertyStatusEvent is recorded server-side).

export function MarketStatusControl({
  propertyId,
  current,
  options,
}: {
  propertyId: string;
  current: string;
  options: readonly MarketStatus[];
}) {
  const [state, formAction, pending] = useActionState(setPropertyMarketStatus, INITIAL);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <FormError errors={state.errors ?? []} />
      <input type="hidden" name="id" value={propertyId} />
      <label className="flex flex-col gap-1">
        <span className="t-body-sm text-text-secondary">Market status</span>
        <select
          name="marketStatus"
          defaultValue={current}
          className="border-divider rounded-md border px-3 py-2"
        >
          {options.map((status) => (
            <option key={status} value={status}>
              {marketStatusLabel(status)}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" variant="secondary" size="sm" loading={pending}>
        Update market status
      </Button>
    </form>
  );
}
