'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, FormError } from '@estate/ui';

import { setPropertyPublished, type PublishState } from './publish-actions.js';

const INITIAL: PublishState = { ok: false };

// EPIC-H property publish control (FR-H-2). A small client form: when the listing is
// a draft it offers "Publish", when live it offers "Unpublish". On success it
// refreshes the route so the badge + the public catalogue reflect the change.

export function PublishControl({
  propertyId,
  published,
}: {
  propertyId: string;
  published: boolean;
}) {
  const [state, formAction, pending] = useActionState(setPropertyPublished, INITIAL);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <FormError errors={state.errors ?? []} />
      <input type="hidden" name="id" value={propertyId} />
      <input type="hidden" name="publish" value={published ? 'false' : 'true'} />
      <Button
        type="submit"
        variant={published ? 'secondary' : 'primary'}
        size="sm"
        loading={pending}
      >
        {published ? 'Unpublish' : 'Publish'}
      </Button>
    </form>
  );
}
