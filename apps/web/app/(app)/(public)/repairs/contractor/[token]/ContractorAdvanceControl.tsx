'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, FormError } from '@estate/ui';

import { advanceRepairAsContractor, type ContractorAdvanceState } from './actions.js';

const INITIAL_STATE: ContractorAdvanceState = { ok: false };

/**
 * EPIC-G contractor portal (FR-G-8) — the single forward-step button. The server
 * derives the actual target from the ticket's current status (the contractor
 * cannot choose it); this just submits the magic-link token and shows the
 * server-supplied step label. Refreshes on success so the next step (or the
 * submitted-for-review note) appears.
 */
export function ContractorAdvanceControl({ token, label }: { token: string; label: string }) {
  const [state, formAction, pending] = useActionState(advanceRepairAsContractor, INITIAL_STATE);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError errors={state.errors ?? []} />
      <input type="hidden" name="token" value={token} />
      <Button type="submit" loading={pending}>
        {label}
      </Button>
    </form>
  );
}
