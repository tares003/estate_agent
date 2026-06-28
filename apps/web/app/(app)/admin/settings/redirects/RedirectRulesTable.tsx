'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, FormError, Select, TextField, type SelectOption } from '@estate/ui';

import {
  createRedirect,
  deleteRedirect,
  updateRedirect,
  type RedirectActionState,
} from './actions.js';

// EPIC-O FR-O-11 — the redirect-rules table + controls. Lists each rule (From / To /
// Type / Hits / Last hit) with an inline edit + delete, and an add-rule form at the
// top. Each form posts to the matching audited Server Action; a success refreshes the
// server-rendered list. Errors from the action are shown as a field-linked summary.
// Mirrors the FeedbackModerationControls / StampDutyConfigEditor client-form pattern.

const INITIAL_STATE: RedirectActionState = { ok: false };

/** A row as serialised by the page (dates → ISO strings for the client boundary). */
export interface RedirectTableRow {
  id: string;
  sourcePath: string;
  destinationPath: string;
  type: string;
  hitCount: number;
  lastHitAt: string | null;
}

/** The redirect-type options offered in the Type dropdown. */
const TYPE_OPTIONS: SelectOption[] = [
  { value: 'r301', label: '301 — permanent' },
  { value: 'r302', label: '302 — temporary' },
  { value: 'r307', label: '307 — temporary' },
  { value: 'gone', label: '410 — gone' },
];

/** Human label for a stored redirect type (falls back to the raw value). */
function typeLabel(type: string): string {
  return TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type;
}

/** Render an ISO timestamp as a short date, or an em dash when never hit. */
function lastHitLabel(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-GB');
}

/** The add-rule form (posts to createRedirect). */
function AddRedirectForm() {
  const [state, formAction, pending] = useActionState(createRedirect, INITIAL_STATE);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={formAction} className="border-divider flex flex-col gap-4 border-b pb-6">
      <h2 className="t-body-md font-semibold">Add a redirect</h2>
      <FormError errors={state.errors ?? []} />
      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <TextField
          id="add-source-path"
          name="sourcePath"
          label="From path"
          hint="The old path, starting with /"
          placeholder="/old-page"
          required
        />
        <TextField
          id="add-destination-path"
          name="destinationPath"
          label="To path"
          hint="Where it should go"
          placeholder="/new-page"
          required
        />
        <Select id="add-type" name="type" label="Type" options={TYPE_OPTIONS} defaultValue="r301" />
        <Button type="submit" loading={pending}>
          Add redirect
        </Button>
      </div>
    </form>
  );
}

/** The inline edit form for one rule (posts to updateRedirect). */
function EditRedirectForm({ row, onDone }: { row: RedirectTableRow; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(updateRedirect, INITIAL_STATE);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      onDone();
      router.refresh();
    }
  }, [state, router, onDone]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError errors={state.errors ?? []} />
      <input type="hidden" name="id" value={row.id} />
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <TextField
          id={`edit-source-${row.id}`}
          name="sourcePath"
          label="From path"
          defaultValue={row.sourcePath}
          required
        />
        <TextField
          id={`edit-destination-${row.id}`}
          name="destinationPath"
          label="To path"
          defaultValue={row.destinationPath}
          required
        />
        <Select
          id={`edit-type-${row.id}`}
          name="type"
          label="Type"
          options={TYPE_OPTIONS}
          defaultValue={row.type}
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={pending}>
          Save changes
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** The delete control for one rule (posts to deleteRedirect). */
function DeleteRedirectButton({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(deleteRedirect, INITIAL_STATE);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="ghost" loading={pending}>
        Delete
      </Button>
    </form>
  );
}

/** One row of the table — view mode, with Edit / Delete; swaps to the edit form. */
function RedirectRow({ row }: { row: RedirectTableRow }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <tr className="border-divider border-b align-top">
        <td colSpan={5} className="py-3">
          <EditRedirectForm row={row} onDone={() => setEditing(false)} />
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-divider border-b align-top">
      <td className="t-body-md py-3 pr-4 break-all">{row.sourcePath}</td>
      <td className="t-body-md py-3 pr-4 break-all">{row.destinationPath}</td>
      <td className="t-body-md py-3 pr-4 whitespace-nowrap">{typeLabel(row.type)}</td>
      <td className="t-body-md py-3 pr-4 whitespace-nowrap">{row.hitCount}</td>
      <td className="t-body-md py-3 pr-4 whitespace-nowrap">{lastHitLabel(row.lastHitAt)}</td>
      <td className="py-3">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <DeleteRedirectButton id={row.id} />
        </div>
      </td>
    </tr>
  );
}

export function RedirectRulesTable({ rows }: { rows: readonly RedirectTableRow[] }) {
  return (
    <div className="flex flex-col gap-6">
      <AddRedirectForm />

      {rows.length === 0 ? (
        <p className="t-body-lg text-text-secondary max-w-[55ch]">
          No redirects yet. Add one above when a page moves so its old address keeps working.
        </p>
      ) : (
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-divider border-b">
              <th scope="col" className="t-body-sm text-text-secondary py-2 pr-4 font-semibold">
                From path
              </th>
              <th scope="col" className="t-body-sm text-text-secondary py-2 pr-4 font-semibold">
                To path
              </th>
              <th scope="col" className="t-body-sm text-text-secondary py-2 pr-4 font-semibold">
                Type
              </th>
              <th scope="col" className="t-body-sm text-text-secondary py-2 pr-4 font-semibold">
                Hits
              </th>
              <th scope="col" className="t-body-sm text-text-secondary py-2 pr-4 font-semibold">
                Last hit
              </th>
              <th scope="col" className="t-body-sm text-text-secondary py-2 font-semibold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <RedirectRow key={row.id} row={row} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
