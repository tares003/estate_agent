'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, FormError, TextField } from '@estate/ui';

import { moderateFeedback, type FeedbackModerateState } from './actions.js';

const INITIAL_STATE: FeedbackModerateState = { ok: false };

/**
 * EPIC-AC FR-AC-5 — the per-row moderation control. A single form posts the
 * decision to `moderateFeedback`: "Publish" submits immediately; "Reject" first
 * reveals a required reason (reject reasons are captured for audit, FR-AC-5),
 * then "Confirm rejection" submits. The decided row leaves the queue, so a
 * success refreshes the server-rendered list. Errors from the action are shown
 * as a field-linked summary (the reason error anchors to the reason field).
 */
export function FeedbackModerationControls({ feedbackId }: { feedbackId: string }) {
  const [state, formAction, pending] = useActionState(moderateFeedback, INITIAL_STATE);
  const [rejecting, setRejecting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError errors={state.errors ?? []} />
      <input type="hidden" name="feedbackId" value={feedbackId} />

      {rejecting ? (
        <div className="flex flex-col gap-3">
          <TextField
            id="reason"
            name="reason"
            label="Reason for rejection"
            hint="Shared with no one outside the team — recorded for the audit log."
            required
          />
          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              name="decision"
              value="reject"
              variant="destructive"
              loading={pending}
            >
              Confirm rejection
            </Button>
            <Button type="button" variant="ghost" onClick={() => setRejecting(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          <Button type="submit" name="decision" value="publish" loading={pending}>
            Publish
          </Button>
          <Button type="button" variant="secondary" onClick={() => setRejecting(true)}>
            Reject
          </Button>
        </div>
      )}
    </form>
  );
}
