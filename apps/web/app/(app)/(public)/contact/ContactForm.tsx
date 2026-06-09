'use client';

import { useActionState, useState } from 'react';
import {
  AntiSpamChallenge,
  Button,
  Checkbox,
  EmailField,
  FormError,
  FormSuccess,
  PhoneField,
  TextField,
} from '@estate/ui';

import { submitContact, type ContactFormState } from './actions.js';
import { CONTACT_CONSENT_TEXT } from './consent-text.js';

const INITIAL_STATE: ContactFormState = { ok: false };

/**
 * EPIC-C general-contact form (PRODUCT.md §4). A client component driven by
 * `useActionState(submitContact, …)`: a failed submit shows a field-linked error
 * summary plus inline field errors; success swaps to a calm confirmation. The
 * consent checkbox carries the exact affirmation the action persists (master spec
 * §S.7).
 */
export function ContactForm() {
  const [state, formAction, pending] = useActionState(submitContact, INITIAL_STATE);

  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

  if (state.ok) {
    return (
      <FormSuccess
        title="Your message has been sent"
        message="Thanks for getting in touch — the agent will reply shortly."
      />
    );
  }

  const errorFor = (name: string) => state.errors?.find((error) => error.field === name)?.message;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      <h2 className="t-heading-sm">Send us a message</h2>

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
      <PhoneField
        id="phone"
        name="phone"
        label="Phone"
        hint="Optional — add a number if you’d prefer a call back."
        autoComplete="tel"
        error={errorFor('phone')}
      />
      <TextField id="message" name="message" label="Message" required error={errorFor('message')} />
      <Checkbox
        id="gdpr_consent"
        name="gdpr_consent"
        label={CONTACT_CONSENT_TEXT}
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
        Send message
      </Button>
    </form>
  );
}
