'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, FormError, Select } from '@estate/ui';

import { assignContractor, type AssignContractorState } from './assign-actions.js';

const INITIAL_STATE: AssignContractorState = { ok: false };

/**
 * EPIC-G repair triage (FR-G-8) — the assign-contractor control. A client
 * component driven by `useActionState(assignContractor, …)`: pick an active
 * contractor and assign; the action moves the ticket to `contractor_assigned` and
 * emails the contractor their no-sign-in magic-link. When there are no active
 * contractors, a quiet pointer to the directory is shown instead of a dead select.
 */
export function AssignContractorControl({
  repairId,
  contractors,
  assignedContractorName,
}: {
  repairId: string;
  contractors: ReadonlyArray<{ id: string; name: string }>;
  assignedContractorName: string | null;
}) {
  const [state, formAction, pending] = useActionState(assignContractor, INITIAL_STATE);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state, router]);

  return (
    <div className="flex flex-col gap-3">
      {assignedContractorName ? (
        <p className="t-body-sm">Assigned to {assignedContractorName}.</p>
      ) : (
        <p className="t-body-sm text-text-secondary">No contractor assigned yet.</p>
      )}

      {contractors.length === 0 ? (
        <p className="t-body-sm text-text-secondary">
          Add an active contractor in the directory to assign this repair.
        </p>
      ) : (
        <form action={formAction} className="flex max-w-[28rem] flex-col gap-3">
          <FormError errors={state.errors ?? []} />
          <input type="hidden" name="repairId" value={repairId} />
          <Select
            id="contractorId"
            name="contractorId"
            label={assignedContractorName ? 'Reassign to' : 'Assign to'}
            placeholder="Choose a contractor…"
            options={contractors.map((contractor) => ({
              value: contractor.id,
              label: contractor.name,
            }))}
          />
          <Button type="submit" variant="secondary" size="sm" loading={pending}>
            Assign &amp; send link
          </Button>
        </form>
      )}
    </div>
  );
}
