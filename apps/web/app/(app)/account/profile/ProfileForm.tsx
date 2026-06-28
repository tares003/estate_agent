'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Checkbox, FormError, FormSuccess, TextField, PhoneField } from '@estate/ui';

import { updateProfile, type ProfileActionState } from './actions.js';

// EPIC-T FR-T-11 — the profile-edit form: display name, optional phone, the
// email/SMS contact preferences and the marketing opt-in. Prefilled from the
// current customer's record (server-read), posting to the audited updateProfile
// action. On success it surfaces an inline confirmation and refreshes the
// server-rendered values; on failure it surfaces the field-scoped errors. Design-
// token classes only (G7); the marketing-opt-in toggle is the consent control —
// there is no fresh GDPR-consent affirmation on this self-service edit.

const INITIAL_STATE: ProfileActionState = { ok: false };

export interface ProfileFormProps {
  name: string;
  phone: string | null;
  contactByEmail: boolean;
  contactBySms: boolean;
  marketingOptIn: boolean;
}

export function ProfileForm({
  name,
  phone,
  contactByEmail,
  contactBySms,
  marketingOptIn,
}: ProfileFormProps) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updateProfile, INITIAL_STATE);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (state.ok) {
      setSaved(true);
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={action} className="flex flex-col gap-6" onChange={() => setSaved(false)}>
      <FormError errors={state.errors ?? []} />
      {saved ? (
        <FormSuccess title="Profile updated" message="Your account details have been saved." />
      ) : null}

      <TextField
        id="profile-name"
        name="name"
        label="Full name"
        defaultValue={name}
        autoComplete="name"
        required
      />

      <PhoneField
        id="profile-phone"
        name="phone"
        label="Phone number"
        hint="Optional. Leave blank if you would rather not share a phone number."
        defaultValue={phone ?? ''}
        autoComplete="tel"
      />

      <fieldset className="flex flex-col gap-3">
        <legend className="t-body-md text-text-primary mb-2 font-medium">
          Communication preferences
        </legend>
        <Checkbox
          id="profile-contact-email"
          name="contactByEmail"
          label="Contact me by email about my account and enquiries"
          defaultChecked={contactByEmail}
        />
        <Checkbox
          id="profile-contact-sms"
          name="contactBySms"
          label="Contact me by SMS about my account and enquiries"
          defaultChecked={contactBySms}
        />
      </fieldset>

      <Checkbox
        id="profile-marketing"
        name="marketingOptIn"
        label="Send me marketing about new properties and services"
        description="Separate from the account messages above. You can turn this off at any time."
        defaultChecked={marketingOptIn}
      />

      <div>
        <Button type="submit" loading={pending}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
