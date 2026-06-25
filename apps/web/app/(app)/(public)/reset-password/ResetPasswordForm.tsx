'use client';

import { useActionState } from 'react';
import { Button, FormError, FormSuccess, TextField } from '@estate/ui';

import { submitResetPassword, type ResetPasswordFormState } from './actions.js';

const INITIAL_STATE: ResetPasswordFormState = { ok: false };

export interface ResetPasswordFormProps {
  /** The opaque reset token from the email link (`?token=…`), carried as a hidden field. */
  token: string;
  /** Seed state — used by tests to render the success branch; defaults to not-submitted. */
  initialState?: ResetPasswordFormState;
}

/**
 * EPIC-N FR-N-5 reset-password form. Centred single-column layout (design brief
 * §Login / register / password-reset screens). A client component driven by
 * `useActionState(submitResetPassword, …)`: a failed submit shows a field-linked
 * error summary plus the inline new-password error (including the "link expired"
 * message); success swaps to a confirmation with a sign-in link. The opaque token
 * rides along as a hidden field — it is the authorisation for the reset, so there
 * is no consent / anti-spam row here (CLAUDE.md §9 — the token is the gate).
 */
export function ResetPasswordForm({ token, initialState = INITIAL_STATE }: ResetPasswordFormProps) {
  const [state, formAction, pending] = useActionState(submitResetPassword, initialState);

  if (state.ok) {
    return (
      <FormSuccess
        title="Your password has been updated"
        message="You can now sign in with your new password."
      >
        <a href="/sign-in" className="underline">
          Sign in
        </a>
      </FormSuccess>
    );
  }

  const errorFor = (name: string) => state.errors?.find((error) => error.field === name)?.message;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      <h2 className="t-heading-sm">Choose a new password</h2>

      <FormError errors={state.errors ?? []} />

      <input type="hidden" name="token" value={token} />

      <TextField
        id="password"
        name="password"
        type="password"
        label="New password"
        autoComplete="new-password"
        hint="Use at least 12 characters — a memorable passphrase works well."
        required
        error={errorFor('password')}
      />

      <Button type="submit" loading={pending}>
        Update password
      </Button>
    </form>
  );
}
