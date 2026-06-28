'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, FormError } from '@estate/ui';

import { deleteSeoMetadata, type SeoMetadataActionState } from './actions.js';
import {
  SeoMetadataEditor,
  emptySeoMetadataValue,
  type SeoMetadataFormValue,
} from './SeoMetadataEditor.js';

// EPIC-O FR-O-4 — the SEO-settings manager. Lists the tenant's SEO overrides (the
// tenant-wide default + each per-entity override) with an inline edit + delete, and a
// "Add an override" affordance that opens a blank editor. Each control posts to the
// matching audited Server Action; a success refreshes the server-rendered list. Mirrors
// the RedirectRulesTable client-form pattern.

const INITIAL_STATE: SeoMetadataActionState = { ok: false };

/** A stored override row, serialised by the page for the client boundary. */
export interface SeoMetadataManagerRow {
  id: string;
  scope: string;
  scopeId: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  ogImage: string | null;
  noIndex: boolean;
  noFollow: boolean;
  /** The structured-data override pretty-printed as JSON (empty when none). */
  structuredData: string;
}

/** Human label for a stored scope value (falls back to the raw value). */
const SCOPE_LABELS: Record<string, string> = {
  default: 'Default (whole site)',
  page: 'Page',
  property: 'Property',
  area_guide: 'Area guide',
  blog_post: 'Blog post',
  branch: 'Branch',
};

function scopeLabel(scope: string): string {
  return SCOPE_LABELS[scope] ?? scope;
}

/** Convert a stored row into the editor's form value. */
function toFormValue(row: SeoMetadataManagerRow): SeoMetadataFormValue {
  return {
    id: row.id,
    scope: row.scope,
    scopeId: row.scopeId,
    metaTitle: row.metaTitle ?? '',
    metaDescription: row.metaDescription ?? '',
    canonicalUrl: row.canonicalUrl ?? '',
    ogImage: row.ogImage ?? '',
    noIndex: row.noIndex,
    noFollow: row.noFollow,
    structuredData: row.structuredData,
  };
}

/** The delete control for one override (posts to deleteSeoMetadata). */
function DeleteOverrideButton({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(deleteSeoMetadata, INITIAL_STATE);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="id" value={id} />
      <FormError errors={state.errors ?? []} />
      <Button type="submit" variant="ghost" loading={pending}>
        Delete
      </Button>
    </form>
  );
}

/** One override row — view mode, with Edit / Delete; swaps to the inline editor. */
function OverrideRow({ row }: { row: SeoMetadataManagerRow }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li className="border-divider border-b py-4">
        <SeoMetadataEditor value={toFormValue(row)} onDone={() => setEditing(false)} />
      </li>
    );
  }

  return (
    <li className="border-divider flex flex-col gap-2 border-b py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="t-body-md font-semibold">{scopeLabel(row.scope)}</span>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <DeleteOverrideButton id={row.id} />
        </div>
      </div>
      {row.scopeId ? (
        <span className="t-body-sm text-text-secondary break-all">Entity: {row.scopeId}</span>
      ) : null}
      <span className="t-body-md">{row.metaTitle || 'No meta title set'}</span>
      {row.metaDescription ? (
        <span className="t-body-sm text-text-secondary">{row.metaDescription}</span>
      ) : null}
      {row.noIndex || row.noFollow ? (
        <span className="t-body-sm text-warning">
          {[row.noIndex ? 'noindex' : null, row.noFollow ? 'nofollow' : null]
            .filter(Boolean)
            .join(' · ')}
        </span>
      ) : null}
    </li>
  );
}

export function SeoMetadataManager({ rows }: { rows: readonly SeoMetadataManagerRow[] }) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      {adding ? (
        <div className="border-divider border-b pb-6">
          <SeoMetadataEditor value={emptySeoMetadataValue()} onDone={() => setAdding(false)} />
        </div>
      ) : (
        <div>
          <Button type="button" onClick={() => setAdding(true)}>
            Add an override
          </Button>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="t-body-lg text-text-secondary max-w-[55ch]">
          No SEO overrides yet. Add the default to set a site-wide title and description, or
          override a single page, property, area guide, blog post or branch.
        </p>
      ) : (
        <ul className="flex flex-col">
          {rows.map((row) => (
            <OverrideRow key={row.id} row={row} />
          ))}
        </ul>
      )}
    </div>
  );
}
