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

import { submitViewing, type ViewingFormState } from './actions.js';
import { VIEWING_CONSENT_TEXT } from './consent-text.js';

const INITIAL_STATE: ViewingFormState = { ok: false };

export interface ViewingFormProps {
  /** The property the viewing is for; submitted as a hidden field. */
  propertyId: string;
  /** The property's display title, woven into the form heading + confirmation. */
  propertyTitle: string;
}

/**
 * EPIC-F viewing-request form (PRODUCT.md §4). A client component driven by
 * `useActionState(submitViewing, …)`: a failed submit shows a field-linked error
 * summary plus inline field errors; success swaps to a calm confirmation. The
 * consent checkbox carries the exact affirmation the action persists (master spec
 * §S.7). Lives on its own per-property route, so its field ids never collide with
 * the property-detail enquiry form.
 */
export function ViewingForm({ propertyId, propertyTitle }: ViewingFormProps) {
  const [state, formAction, pending] = useActionState(submitViewing, INITIAL_STATE);

  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

  if (state.ok) {
    return (
      <FormSuccess
        title="Your viewing request has been sent"
        message="The agent will be in touch shortly to confirm a time."
      />
    );
  }

  const errorFor = (name: string) => state.errors?.find((error) => error.field === name)?.message;
  const dateInputClass = 'border-divider rounded-md border px-3 py-2';

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      <h2 className="t-heading-sm">Book a viewing of {propertyTitle}</h2>

      <FormError errors={state.errors ?? []} />

      <input type="hidden" name="propertyId" value={propertyId} />

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
      <label htmlFor="preferredDate" className="flex flex-col gap-1">
        <span className="t-body-sm text-text-secondary">Preferred date</span>
        <input
          id="preferredDate"
          type="date"
          name="preferredDate"
          required
          className={dateInputClass}
        />
      </label>
      <label htmlFor="alternativeDate" className="flex flex-col gap-1">
        <span className="t-body-sm text-text-secondary">Alternative date (optional)</span>
        <input id="alternativeDate" type="date" name="alternativeDate" className={dateInputClass} />
      </label>
      <TextField
        id="message"
        name="message"
        label="Anything else?"
        hint="Optional"
        error={errorFor('message')}
      />
      <Checkbox
        id="gdpr_consent"
        name="gdpr_consent"
        label={VIEWING_CONSENT_TEXT}
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
        Request viewing
      </Button>
    </form>
  );
}
