'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, FormError } from '@estate/ui';
import { CONTACT_TYPES } from '@estate/validators';

import { convertEnquiry, type EnquiryConversionState } from '../conversion-actions.js';

// EPIC-H enquiry detail (FR-H-3 / FR-I-6) — the conversion control. A client form
// driven by `useActionState(convertEnquiry, …)`: the staff member picks the contact
// type, and on success the route refreshes (the enquiry becomes `converted`). The
// page only renders this when the enquiry can legally reach `converted`; the action
// re-checks server-side.

const INITIAL: EnquiryConversionState = { ok: false };

const TYPE_OPTIONS = CONTACT_TYPES.map((value) => ({
  value,
  label: value.charAt(0).toUpperCase() + value.slice(1),
}));

export function ConvertForm({ enquiryId }: { enquiryId: string }) {
  const [state, formAction] = useActionState(convertEnquiry, INITIAL);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  if (state.ok) {
    return <p className="t-body-sm text-text-secondary">Converted to a contact.</p>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError errors={state.errors ?? []} />
      <input type="hidden" name="enquiryId" value={enquiryId} />
      <label className="flex flex-col gap-1">
        <span className="t-body-sm text-text-secondary">Contact type</span>
        <select
          name="contactType"
          required
          defaultValue=""
          className="border-divider rounded-md border px-3 py-2"
        >
          <option value="" disabled>
            Choose a type…
          </option>
          {TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" variant="secondary" size="sm">
        Convert to contact
      </Button>
    </form>
  );
}
