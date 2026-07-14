'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, FormError } from '@estate/ui';

import { softDeleteProperty, type SoftDeleteState } from './soft-delete-actions.js';

const INITIAL: SoftDeleteState = { ok: false };

// EPIC-F FR-F-10 — the admin soft-delete control. Deliberately a TWO-step gesture:
// the first click only reveals the confirm step (nothing is submitted), and only
// "Confirm delete" posts to the audited softDeleteProperty action. On success the
// listing is gone from the admin catalogue reads too, so the control routes back
// to /admin/properties rather than refreshing a page that would 404.

export function SoftDeleteControl({ propertyId }: { propertyId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(softDeleteProperty, INITIAL);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      router.push('/admin/properties');
      router.refresh();
    }
  }, [state, router]);

  if (!confirming) {
    return (
      <Button type="button" variant="destructive" size="sm" onClick={() => setConfirming(true)}>
        Delete listing
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <FormError errors={state.errors ?? []} />
      <input type="hidden" name="id" value={propertyId} />
      <p className="t-body-sm text-text-secondary max-w-[55ch]">
        Deleting removes this listing from the public site and the admin catalogue.
      </p>
      <div className="flex items-center gap-2">
        <Button type="submit" variant="destructive" size="sm" loading={pending}>
          Confirm delete
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
