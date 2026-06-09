'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, FormError } from '@estate/ui';

import { addEnquiryNote, type EnquiryNoteState } from '../note-actions.js';

// EPIC-H enquiry detail (FR-H-3) — the note composer. A client form driven by
// `useActionState(addEnquiryNote, …)`. A note is staff-internal by default; ticking
// "visible to the client" submits `isInternal=false` (the action treats only an
// explicit `false` as client-visible). On success it remounts the form (clearing
// it) and refreshes the route so the new note appears in the thread.

const INITIAL: EnquiryNoteState = { ok: false };

export function NoteComposer({ enquiryId }: { enquiryId: string }) {
  const [state, formAction] = useActionState(addEnquiryNote, INITIAL);
  const [version, setVersion] = useState(0);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      setVersion((value) => value + 1);
      router.refresh();
    }
  }, [state, router]);

  return (
    <form key={version} action={formAction} className="flex flex-col gap-3">
      <FormError errors={state.errors ?? []} />
      <input type="hidden" name="enquiryId" value={enquiryId} />
      <label className="flex flex-col gap-1">
        <span className="t-body-sm text-text-secondary">Add a note</span>
        <textarea
          name="body"
          required
          rows={3}
          className="border-divider rounded-md border px-3 py-2"
        />
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" name="isInternal" value="false" />
        <span className="t-body-sm">Visible to the client</span>
      </label>
      <Button type="submit" variant="secondary" size="sm">
        Add note
      </Button>
    </form>
  );
}
