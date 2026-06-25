'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, EmailField, FormError, TextField } from '@estate/ui';

import { submitSignIn, type SignInFormState } from './actions.js';

const INITIAL_STATE: SignInFormState = { ok: false };

export interface SignInFormProps {
  /**
   * The sanitised route to return to after sign-in (`?next=`), carried through as
   * a hidden field so the action can honour it (FR-T-3). Defaults to undefined,
   * in which case the action falls back to the `/account` dashboard.
   */
  next?: string;
  /** Seed state — used by tests to render the error branch; defaults to not-submitted. */
  initialState?: SignInFormState;
}

/**
 * EPIC-T FR-T-3 sign-in form. Centred single-column layout (design brief
 * §Authentication forms). A client component driven by
 * `useActionState(submitSignIn, …)`: a failed submit shows a single GENERIC error
 * (never disclosing which half of the credential was wrong — account-enumeration
 * defence); on success the action returns the sanitised `redirectTo` and the form
 * navigates there, returning the customer to the route they were trying to reach.
 * Helper links offer password recovery and account creation (design brief §sign-in
 * — "forgot password" + "create account").
 */
export function SignInForm({ next, initialState = INITIAL_STATE }: SignInFormProps = {}) {
  const [state, formAction, pending] = useActionState(submitSignIn, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.ok && state.redirectTo) {
      router.push(state.redirectTo);
    }
  }, [state.ok, state.redirectTo, router]);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      <h2 className="t-heading-sm">Sign in</h2>

      <FormError errors={state.errors ?? []} />

      {next ? <input type="hidden" name="next" value={next} /> : null}

      <EmailField id="email" name="email" label="Email" autoComplete="email" required />
      <TextField
        id="password"
        name="password"
        type="password"
        label="Password"
        autoComplete="current-password"
        required
      />

      <div className="t-body-sm">
        <a href="/forgot-password" className="underline">
          Forgot your password?
        </a>
      </div>

      <Button type="submit" loading={pending}>
        Sign in
      </Button>

      <p className="t-body-sm text-text-secondary">
        New here?{' '}
        <a href="/register" className="underline">
          Create an account
        </a>
      </p>
    </form>
  );
}
