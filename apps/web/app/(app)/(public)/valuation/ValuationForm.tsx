'use client';

import { useActionState, useState } from 'react';
import {
  AntiSpamChallenge,
  Button,
  Checkbox,
  EmailField,
  FormError,
  FormSuccess,
  NumberField,
  PhoneField,
  TextField,
} from '@estate/ui';

import { submitValuation, type ValuationFormState } from './actions.js';
import { VALUATION_CONSENT_TEXT } from './consent-text.js';

const INITIAL_STATE: ValuationFormState = { ok: false };

/**
 * EPIC-C valuation-request form (PRODUCT.md §4). A client component driven by
 * `useActionState(submitValuation, …)`: a failed submit shows a field-linked error
 * summary plus inline field errors; success swaps to a calm confirmation. The
 * consent checkbox carries the exact affirmation the action persists (master spec
 * §S.7).
 */
export function ValuationForm() {
  const [state, formAction, pending] = useActionState(submitValuation, INITIAL_STATE);

  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

  if (state.ok) {
    return (
      <FormSuccess
        title="Your valuation request has been sent"
        message="The agent will be in touch shortly to arrange your valuation."
      />
    );
  }

  const errorFor = (name: string) => state.errors?.find((error) => error.field === name)?.message;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      <h2 className="t-heading-sm">Request your valuation</h2>

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
        autoComplete="tel"
        required
        error={errorFor('phone')}
      />
      <TextField
        id="addressLine1"
        name="addressLine1"
        label="Property address"
        autoComplete="address-line1"
        required
        error={errorFor('addressLine1')}
      />
      <TextField
        id="postcode"
        name="postcode"
        label="Postcode"
        autoComplete="postal-code"
        required
        error={errorFor('postcode')}
      />
      <TextField
        id="propertyType"
        name="propertyType"
        label="Property type"
        hint="e.g. terraced house, flat, bungalow"
        required
        error={errorFor('propertyType')}
      />
      <NumberField
        id="bedrooms"
        name="bedrooms"
        label="Bedrooms"
        hint="Optional"
        error={errorFor('bedrooms')}
      />
      <Checkbox
        id="gdpr_consent"
        name="gdpr_consent"
        label={VALUATION_CONSENT_TEXT}
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
        Request valuation
      </Button>
    </form>
  );
}
