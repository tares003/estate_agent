'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, FormError, TextField } from '@estate/ui';

import { editFeedback, moderateFeedback, type FeedbackModerateState } from './actions.js';

const INITIAL_STATE: FeedbackModerateState = { ok: false };

/**
 * EPIC-AC FR-AC-5 — the per-row moderation control. A single form posts the
 * decision to `moderateFeedback`: "Publish" submits immediately; "Reject" first
 * reveals a required reason (reject reasons are captured for audit, FR-AC-5),
 * then "Confirm rejection" submits. "Edit" reveals the current comment seeded
 * into an editable field and posts a MINOR edit (comment-only) to `editFeedback`
 * before the entry is decided. Publish / reject remove the row from the queue;
 * an edit keeps it with new text — either success refreshes the server-rendered
 * list. Errors from the action are shown as a field-linked summary.
 */
export function FeedbackModerationControls({
  feedbackId,
  comment,
}: {
  feedbackId: string;
  comment?: string | null;
}) {
  const [state, formAction, pending] = useActionState(moderateFeedback, INITIAL_STATE);
  const [editState, editAction, editPending] = useActionState(editFeedback, INITIAL_STATE);
  const [rejecting, setRejecting] = useState(false);
  const [editing, setEditing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state, router]);

  useEffect(() => {
    if (editState.ok) {
      setEditing(false);
      router.refresh();
    }
  }, [editState, router]);

  if (editing) {
    return (
      <form action={editAction} className="flex flex-col gap-3">
        <FormError errors={editState.errors ?? []} />
        <input type="hidden" name="feedbackId" value={feedbackId} />
        <TextField
          id={`edit-comment-${feedbackId}`}
          name="comment"
          label="Edit comment"
          hint="Minor edits only — fix a typo or trim wording. Recorded in the audit log."
          defaultValue={comment ?? ''}
        />
        <div className="flex flex-wrap gap-3">
          <Button type="submit" loading={editPending}>
            Save edit
          </Button>
          <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

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
          <Button type="button" variant="ghost" onClick={() => setEditing(true)}>
            Edit
          </Button>
        </div>
      )}
    </form>
  );
}
