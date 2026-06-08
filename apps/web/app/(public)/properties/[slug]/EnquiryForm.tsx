'use client';

import { useActionState } from 'react';
import {
  Button,
  Checkbox,
  EmailField,
  FormError,
  FormSuccess,
  PhoneField,
  TextField,
} from '@estate/ui';
import { submitEnquiry, type EnquiryFormState } from './actions.js';
import { ENQUIRY_CONSENT_TEXT } from './consent-text.js';

const INITIAL_STATE: EnquiryFormState = { ok: false };

export interface EnquiryFormProps {
  /** The property the enquiry is about; submitted as a hidden field. */
  propertyId: string;
  /** The property's display title, woven into the form heading + confirmation. */
  propertyTitle: string;
}

/**
 * EPIC-F / EPIC-I buyer-enquiry form. A client component driven by
 * `useActionState(submitEnquiry, …)`: on a failed submit it shows a form-level
 * error summary (anchored to each field by id) plus inline field errors; on
 * success it swaps to a calm `FormSuccess` confirmation that says what happens
 * next (design-requirements §7). The consent checkbox carries the exact
 * affirmation text the action persists, so what the user agreed to and what is
 * stored are identical (master spec §S.7).
 */
export function EnquiryForm({ propertyId, propertyTitle }: EnquiryFormProps) {
  const [state, formAction, pending] = useActionState(submitEnquiry, INITIAL_STATE);

  if (state.ok) {
    return (
      <FormSuccess
        title="Your enquiry has been sent"
        message="The agent will be in touch shortly. We've logged your enquiry against this property."
      />
    );
  }

  const errorFor = (field: string) => state.errors?.find((error) => error.field === field)?.message;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      <h2 className="t-heading-sm">Enquire about {propertyTitle}</h2>

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
        hint="Optional — add a number if you'd prefer a call back."
        autoComplete="tel"
        error={errorFor('phone')}
      />
      <TextField id="message" name="message" label="Message" required error={errorFor('message')} />
      <Checkbox
        id="gdpr_consent"
        name="gdpr_consent"
        label={ENQUIRY_CONSENT_TEXT}
        required
        error={errorFor('gdpr_consent')}
      />

      <Button type="submit" loading={pending}>
        Send enquiry
      </Button>
    </form>
  );
}
