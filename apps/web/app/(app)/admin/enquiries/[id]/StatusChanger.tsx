'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, FormError } from '@estate/ui';

import { updateEnquiryStatus, type EnquiryStatusState } from '../actions.js';
import { LOST_REASON_OPTIONS, type StatusOption } from './next-statuses.js';

// EPIC-H enquiry detail (FR-H-3) — the status workflow control. A client form
// driven by `useActionState(updateEnquiryStatus, …)`: the select offers only the
// legal next statuses (the allow-list, passed in), a reason is required when moving
// to `lost`, and a failed submit surfaces the action's field-linked errors. On
// success it refreshes the route so the badge + any downstream views reflect the
// new status (the action itself stays pure — it returns state, not redirects).

const INITIAL: EnquiryStatusState = { ok: false };

export function StatusChanger({
  enquiryId,
  options,
}: {
  enquiryId: string;
  options: StatusOption[];
}) {
  const [state, formAction] = useActionState(updateEnquiryStatus, INITIAL);
  const [to, setTo] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      setTo('');
      router.refresh();
    }
  }, [state, router]);

  if (options.length === 0) {
    return <p className="t-body-sm text-text-secondary">No further status changes available.</p>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError errors={state.errors ?? []} />
      <input type="hidden" name="enquiryId" value={enquiryId} />
      <label className="flex flex-col gap-1">
        <span className="t-body-sm text-text-secondary">Move to</span>
        <select
          name="to"
          required
          value={to}
          onChange={(event) => setTo(event.target.value)}
          className="border-divider rounded-md border px-3 py-2"
        >
          <option value="" disabled>
            Choose a status…
          </option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {to === 'lost' ? (
        <label className="flex flex-col gap-1">
          <span className="t-body-sm text-text-secondary">Reason</span>
          <select name="reason" required className="border-divider rounded-md border px-3 py-2">
            <option value="" disabled>
              Why was it lost?…
            </option>
            {LOST_REASON_OPTIONS.map((reason) => (
              <option key={reason.value} value={reason.value}>
                {reason.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <Button type="submit" variant="primary" size="sm">
        Update status
      </Button>
    </form>
  );
}
