'use client';

import { useActionState } from 'react';
import { Button, Checkbox, FormError, FormSuccess, Select, TextField } from '@estate/ui';

import { submitFeedback, type FeedbackFormState } from './actions.js';

// EPIC-AC FR-AC-3 — the brief, no-sign-in feedback form. A 1–5 rating, an optional
// short comment, and a publish-as-testimonial toggle. The signed one-time token
// (passed from the page, hidden here) authorises the submission; the action derives
// everything else from it. Driven by `useActionState(submitFeedback, …)`: a failed
// submit shows a field-linked error summary; success swaps to a calm thank-you.

const INITIAL_STATE: FeedbackFormState = { ok: false };

const RATINGS = [
  { value: '5', label: '5 — Excellent' },
  { value: '4', label: '4 — Good' },
  { value: '3', label: '3 — Okay' },
  { value: '2', label: '2 — Poor' },
  { value: '1', label: '1 — Very poor' },
];

export function FeedbackForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(submitFeedback, INITIAL_STATE);

  if (state.ok) {
    return (
      <FormSuccess
        title="Thank you for your feedback"
        message="We really appreciate you taking the time to let us know."
      />
    );
  }

  const errorFor = (name: string) => state.errors?.find((error) => error.field === name)?.message;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="token" value={token} />

      <FormError errors={state.errors ?? []} />

      <Select
        id="rating"
        name="rating"
        label="How would you rate your experience?"
        options={RATINGS}
        placeholder="Choose a rating"
        required
        error={errorFor('rating')}
      />
      <TextField
        id="comment"
        name="comment"
        label="Anything you’d like to add?"
        hint="Optional — a short comment"
        error={errorFor('comment')}
      />
      <Checkbox
        id="publishAsTestimonial"
        name="publishAsTestimonial"
        label="You may publish this as a testimonial."
      />

      <Button type="submit" loading={pending}>
        Send feedback
      </Button>
    </form>
  );
}
