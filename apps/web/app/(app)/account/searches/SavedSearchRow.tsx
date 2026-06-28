'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, FormError, Modal, Select, TextField, type SelectOption } from '@estate/ui';
import type { AlertFrequency } from '@estate/validators';

import {
  deleteSavedSearch,
  renameSavedSearch,
  updateSavedSearchFrequency,
  type SavedSearchActionState,
} from './actions.js';

// EPIC-T FR-T-8 — one saved-search management row: its name, a criteria summary,
// an alert-frequency selector, a "Run search now" link, a rename affordance, and a
// delete with a confirmation modal (design brief §Saved searches). Each control
// posts to the matching audited action; a success refreshes the server-rendered
// list. Design-token classes only (G7).

const INITIAL_STATE: SavedSearchActionState = { ok: false };

/** The alert-cadence options (off / instant / daily / weekly). */
const FREQUENCY_OPTIONS: SelectOption[] = [
  { value: 'off', label: 'No alerts' },
  { value: 'instant', label: 'Instant' },
  { value: 'daily', label: 'Daily digest' },
  { value: 'weekly', label: 'Weekly digest' },
];

export interface SavedSearchRowProps {
  id: string;
  name: string;
  alertFrequency: AlertFrequency;
  /** Human-readable summary of the saved filters (criteria chips, joined). */
  criteriaSummary: string;
  /** The /properties query string that re-runs this saved search. */
  runHref: string;
}

export function SavedSearchRow({
  id,
  name,
  alertFrequency,
  criteriaSummary,
  runHref,
}: SavedSearchRowProps) {
  const router = useRouter();
  const [frequencyState, frequencyAction] = useActionState(
    updateSavedSearchFrequency,
    INITIAL_STATE,
  );
  const [renameState, renameAction, renamePending] = useActionState(
    renameSavedSearch,
    INITIAL_STATE,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteSavedSearch,
    INITIAL_STATE,
  );
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (frequencyState.ok) router.refresh();
  }, [frequencyState, router]);

  useEffect(() => {
    if (renameState.ok) {
      setEditing(false);
      router.refresh();
    }
  }, [renameState, router]);

  useEffect(() => {
    if (deleteState.ok) {
      setConfirmingDelete(false);
      router.refresh();
    }
  }, [deleteState, router]);

  return (
    <li className="bg-surface-raised flex flex-col gap-4 rounded-lg p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          {editing ? (
            <form action={renameAction} className="flex flex-col gap-2">
              <FormError errors={renameState.errors ?? []} />
              <input type="hidden" name="id" value={id} />
              <TextField
                id={`rename-${id}`}
                name="name"
                label="Search name"
                defaultValue={name}
                required
              />
              <div className="flex flex-wrap gap-2">
                <Button type="submit" loading={renamePending}>
                  Save name
                </Button>
                <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <>
              <h2 className="t-body-lg text-text-primary font-medium">{name}</h2>
              <p className="t-body-sm text-text-secondary">{criteriaSummary}</p>
            </>
          )}
        </div>

        {!editing ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditing(true)}>
              Rename
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmingDelete(true)}
              aria-label={`Delete saved search ${name}`}
            >
              Delete
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <form action={frequencyAction} className="flex items-end gap-2">
          <input type="hidden" name="id" value={id} />
          <Select
            id={`frequency-${id}`}
            name="alertFrequency"
            label="Email alerts"
            options={FREQUENCY_OPTIONS}
            defaultValue={alertFrequency}
          />
          <Button type="submit" variant="secondary">
            Update alerts
          </Button>
        </form>
        <a href={runHref} className="t-body-sm text-brand-accent underline">
          Run search now
        </a>
      </div>

      <Modal
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        title="Delete saved search?"
      >
        <form action={deleteAction} className="flex flex-col gap-4">
          <FormError errors={deleteState.errors ?? []} />
          <input type="hidden" name="id" value={id} />
          <p className="t-body-md text-text-secondary">
            “{name}” will be removed and you will stop receiving alerts for it. This cannot be
            undone.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" variant="destructive" loading={deletePending}>
              Delete search
            </Button>
            <Button type="button" variant="ghost" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </li>
  );
}
