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
  Select,
  TextField,
  type SelectOption,
} from '@estate/ui';

import { submitRepairRequest, type RepairFormState } from './actions.js';
import { REPAIR_CONSENT_TEXT } from './consent-text.js';

const INITIAL_STATE: RepairFormState = { ok: false };

// The committed urgency taxonomy (repairUrgency in @estate/validators). Labels are
// the plain humanised levels — the SLA / dispatch semantics per level are FR-G-5
// and live downstream, not in the intake copy.
const URGENCY_OPTIONS: SelectOption[] = [
  { value: 'emergency', label: 'Emergency' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'standard', label: 'Standard' },
  { value: 'low', label: 'Low' },
];

/**
 * EPIC-G tenant repair-report form (PRODUCT.md §4, FR-G-1). A client component
 * driven by `useActionState(submitRepairRequest, …)`: a failed submit shows a
 * field-linked error summary plus inline field errors; success swaps to a calm
 * confirmation. The consent checkbox carries the exact affirmation the action
 * persists (master spec §S.7).
 */
export function RepairForm() {
  const [state, formAction, pending] = useActionState(submitRepairRequest, INITIAL_STATE);

  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

  if (state.ok) {
    return (
      <FormSuccess
        title="Your repair has been reported"
        message="The agent’s repairs team will be in touch about the next steps."
      />
    );
  }

  const errorFor = (name: string) => state.errors?.find((error) => error.field === name)?.message;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      <h2 className="t-heading-sm">Report a repair</h2>

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
        id="propertyReference"
        name="propertyReference"
        label="Property reference or address"
        hint="The address or reference of the property that needs the repair"
        required
        error={errorFor('propertyReference')}
      />
      <TextField
        id="category"
        name="category"
        label="What needs repairing?"
        hint="e.g. plumbing, heating, electrics"
        required
        error={errorFor('category')}
      />
      <label htmlFor="description" className="flex flex-col gap-1">
        <span className="t-body-sm text-text-secondary">Describe the problem</span>
        <textarea
          id="description"
          name="description"
          required
          rows={4}
          className="border-divider rounded-md border px-3 py-2"
        />
      </label>
      <Select
        id="urgency"
        name="urgency"
        label="How urgent is it?"
        options={URGENCY_OPTIONS}
        defaultValue="standard"
        error={errorFor('urgency')}
      />
      <Checkbox
        id="gdpr_consent"
        name="gdpr_consent"
        label={REPAIR_CONSENT_TEXT}
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
        Report repair
      </Button>
    </form>
  );
}
