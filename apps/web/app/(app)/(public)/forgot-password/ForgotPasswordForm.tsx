'use client';

import { useActionState, useState } from 'react';
import { AntiSpamChallenge, Button, Checkbox, EmailField, FormError, FormSuccess } from '@estate/ui';

import { submitForgotPassword, type ForgotPasswordFormState } from './actions.js';
import { FORGOT_PASSWORD_CONSENT_TEXT } from './consent-text.js';

const INITIAL_STATE: ForgotPasswordFormState = { ok: false };

export interface ForgotPasswordFormProps {
  /** Seed state — used by tests to render the success branch; defaults to not-submitted. */
  initialState?: ForgotPasswordFormState;
}

/**
 * EPIC-N FR-N-5 forgot-password form. Centred single-column layout (design brief
 * §Login / register / password-reset screens). A client component driven by
 * `useActionState(submitForgotPassword, …)`: a failed submit shows a field-linked
 * error summary plus inline field errors; success swaps to a calm, ENUMERATION-SAFE
 * confirmation that says the link has been sent IF the address is registered —
 * never confirming whether the account exists. The GDPR consent checkbox carries
 * the exact affirmation the action persists (G5); the anti-spam challenge sits
 * between consent and submit (CLAUDE.md §9).
 */
export function ForgotPasswordForm({
  initialState = INITIAL_STATE,
}: ForgotPasswordFormProps = {}) {
  const [state, formAction, pending] = useActionState(submitForgotPassword, initialState);

  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

  if (state.ok) {
    return (
      <FormSuccess
        title="Check your email"
        message="If that email address has an account, we’ve sent a link to reset your password. The link expires in 60 minutes."
      />
    );
  }

  const errorFor = (name: string) => state.errors?.find((error) => error.field === name)?.message;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      <h2 className="t-heading-sm">Reset your password</h2>

      <p className="t-body-sm text-text-secondary">
        Enter the email address for your account and we’ll send you a link to choose a new password.
      </p>

      <FormError errors={state.errors ?? []} />

      <EmailField
        id="email"
        name="email"
        label="Email"
        autoComplete="email"
        required
        error={errorFor('email')}
      />

      <Checkbox
        id="gdpr_consent"
        name="gdpr_consent"
        label={FORGOT_PASSWORD_CONSENT_TEXT}
        required
        error={errorFor('gdpr_consent')}
      />

      {turnstileSiteKey ? (
        <>
          <AntiSpamChallenge sitekey={turnstileSiteKey} onVerify={setTurnstileToken} />
          <input type="hidden" name="cf-turnstile-response" value={turnstileToken} />
        </>
      ) : null}

      <Button type="submit" loading={pending}>
        Send reset link
      </Button>

      <p className="t-body-sm text-text-secondary">
        Remembered it?{' '}
        <a href="/sign-in" className="underline">
          Sign in
        </a>
      </p>
    </form>
  );
}
