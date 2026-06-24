'use client';

import { useActionState, useState } from 'react';
import {
  AntiSpamChallenge,
  Button,
  Checkbox,
  EmailField,
  FormError,
  FormSuccess,
  TextField,
} from '@estate/ui';

import { submitRegister, type RegisterFormState } from './actions.js';
import { REGISTER_CONSENT_TEXT } from './consent-text.js';

const INITIAL_STATE: RegisterFormState = { ok: false };

export interface RegisterFormProps {
  /** Seed state — used by tests to render the success branch; defaults to not-submitted. */
  initialState?: RegisterFormState;
}

/**
 * EPIC-T FR-T-1 register form. Centred single-column layout (design brief
 * §Authentication forms). A client component driven by
 * `useActionState(submitRegister, …)`: a failed submit shows a field-linked error
 * summary plus inline field errors; success swaps to a calm "verify your email"
 * confirmation (FR-T-2 gates saving until verified). The GDPR consent checkbox
 * carries the exact affirmation the action persists (G5); the marketing opt-in is
 * a SEPARATE optional row that never blocks registration. Anti-spam challenge sits
 * between consent and submit (CLAUDE.md §9).
 */
export function RegisterForm({ initialState = INITIAL_STATE }: RegisterFormProps = {}) {
  const [state, formAction, pending] = useActionState(submitRegister, initialState);

  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

  if (state.ok) {
    return (
      <FormSuccess
        title="Check your email to verify your account"
        message="We’ve sent you a verification link. Open it to finish setting up your account and start saving properties."
      />
    );
  }

  const errorFor = (name: string) => state.errors?.find((error) => error.field === name)?.message;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      <h2 className="t-heading-sm">Create your account</h2>

      <FormError errors={state.errors ?? []} />

      <TextField
        id="name"
        name="name"
        label="Your name"
        autoComplete="name"
        required
        error={errorFor('name')}
      />
      <EmailField
        id="email"
        name="email"
        label="Email"
        autoComplete="email"
        required
        error={errorFor('email')}
      />
      <TextField
        id="password"
        name="password"
        type="password"
        label="Password"
        autoComplete="new-password"
        hint="Use at least 12 characters — a memorable passphrase works well."
        required
        error={errorFor('password')}
      />

      <Checkbox
        id="gdpr_consent"
        name="gdpr_consent"
        label={REGISTER_CONSENT_TEXT}
        required
        error={errorFor('gdpr_consent')}
      />
      <Checkbox
        id="marketingOptIn"
        name="marketingOptIn"
        label="Email me occasional updates and new-property alerts (optional — you can change this anytime)."
      />

      {turnstileSiteKey ? (
        <>
          <AntiSpamChallenge sitekey={turnstileSiteKey} onVerify={setTurnstileToken} />
          <input type="hidden" name="cf-turnstile-response" value={turnstileToken} />
        </>
      ) : null}

      <Button type="submit" loading={pending}>
        Create account
      </Button>

      <p className="t-body-sm text-text-secondary">
        Already have an account?{' '}
        <a href="/sign-in" className="underline">
          Sign in
        </a>
      </p>
    </form>
  );
}
