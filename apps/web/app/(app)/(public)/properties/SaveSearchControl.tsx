'use client';

import { useActionState, useEffect, useState } from 'react';
import { Button, FormError, Select, TextField, type SelectOption } from '@estate/ui';
import { ALERT_FREQUENCIES } from '@estate/validators';

import { createSavedSearch, type SavedSearchActionState } from '../../account/searches/actions.js';

// EPIC-T FR-T-7 — the "Save this search" control on /properties. It carries the
// currently-active filter combination (the parent serialises the parsed
// PropertySearch to JSON — the /properties URL is the single source of truth for
// filter state) into createSavedSearch, alongside a customer-chosen name and alert
// cadence. Signed-out / unverified visitors instead see a link to sign in; the
// action itself is the fail-closed gate (this is only the affordance). Design-token
// classes only (G7).

const INITIAL_STATE: SavedSearchActionState = { ok: false };

/** The alert-cadence options (off / instant / daily / weekly). */
const FREQUENCY_OPTIONS: SelectOption[] = [
  { value: 'off', label: 'No alerts' },
  { value: 'instant', label: 'Instant' },
  { value: 'daily', label: 'Daily digest' },
  { value: 'weekly', label: 'Weekly digest' },
];

export interface SaveSearchControlProps {
  /** The active filters as JSON (the serialised PropertySearch the route parsed). */
  filtersJson: string;
  /** Whether a verified customer is signed in (server-resolved). */
  signedIn: boolean;
  /** The path to return to after sign-in (signed-out variant). */
  currentPath?: string;
}

export function SaveSearchControl({ filtersJson, signedIn, currentPath }: SaveSearchControlProps) {
  const [state, formAction, pending] = useActionState(createSavedSearch, INITIAL_STATE);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      setSaved(true);
    }
  }, [state]);

  // Signed out — link to sign-in, preserving the route to return to (FR-T-5 shape).
  if (!signedIn) {
    const next = encodeURIComponent(currentPath ?? '/properties');
    return (
      <a href={`/sign-in?next=${next}`} className="t-body-sm text-brand-accent underline">
        Sign in to save this search
      </a>
    );
  }

  if (saved) {
    return (
      <p className="t-body-sm text-text-secondary" role="status">
        Search saved.{' '}
        <a href="/account/searches" className="text-brand-accent underline">
          Manage saved searches
        </a>
      </p>
    );
  }

  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        Save this search
      </Button>
    );
  }

  return (
    <form action={formAction} className="bg-surface-raised flex flex-col gap-4 rounded-lg p-4">
      <FormError errors={state.errors ?? []} />
      <input type="hidden" name="filters" value={filtersJson} />
      <TextField
        id="saved-search-name"
        name="name"
        label="Name this search"
        placeholder="e.g. Two-bed flats in Didsbury"
        required
      />
      <Select
        id="saved-search-frequency"
        name="alertFrequency"
        label="Email alerts"
        options={FREQUENCY_OPTIONS}
        defaultValue={ALERT_FREQUENCIES[0]}
      />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={pending}>
          Save search
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
