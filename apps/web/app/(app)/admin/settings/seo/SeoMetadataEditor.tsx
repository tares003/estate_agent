'use client';

import { useActionState, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Checkbox,
  FormError,
  FormSuccess,
  Select,
  TextField,
  type SelectOption,
} from '@estate/ui';
import { SEO_META_DESCRIPTION_MAX, SEO_META_TITLE_MAX } from '@estate/validators';

import { upsertSeoMetadata, type SeoMetadataActionState } from './actions.js';

// EPIC-O FR-O-4 — the per-entity SEO-metadata editor. A single form that creates or
// edits one override (or the tenant-wide default). Live, aria-live="polite" character
// counters track the meta-title (≤ 60) and description (≤ 160) SERP ceilings, shifting
// neutral → warning → danger as the input nears / passes the limit (design brief). The
// canonical-URL override is collapsed under an "Advanced" toggle. On submit it posts to
// the audited upsertSeoMetadata action; the schema validates server-side. Mirrors the
// RedirectRulesTable / StampDutyConfigEditor client-form pattern.

const INITIAL_STATE: SeoMetadataActionState = { ok: false };

/** The scope options offered in the editor's scope dropdown. */
const SCOPE_OPTIONS: SelectOption[] = [
  { value: 'default', label: 'Default (whole site)' },
  { value: 'page', label: 'Page' },
  { value: 'property', label: 'Property' },
  { value: 'area_guide', label: 'Area guide' },
  { value: 'blog_post', label: 'Blog post' },
  { value: 'branch', label: 'Branch' },
];

/** The override an edit form pre-fills from (a stored row, serialised for the client). */
export interface SeoMetadataFormValue {
  id: string | null;
  scope: string;
  scopeId: string | null;
  metaTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  ogImage: string;
  noIndex: boolean;
  noFollow: boolean;
  /** The structured-data override, pretty-printed as JSON (empty when none). */
  structuredData: string;
}

/** A blank create form, optionally pre-seeding the scope. */
export function emptySeoMetadataValue(scope = 'default'): SeoMetadataFormValue {
  return {
    id: null,
    scope,
    scopeId: null,
    metaTitle: '',
    metaDescription: '',
    canonicalUrl: '',
    ogImage: '',
    noIndex: false,
    noFollow: false,
    structuredData: '',
  };
}

/** The counter tone for a length against its recommended ceiling. */
function counterTone(length: number, max: number): 'neutral' | 'warning' | 'danger' {
  if (length > max) return 'danger';
  if (length >= max * 0.9) return 'warning';
  return 'neutral';
}

/** Tailwind text-colour class for a counter tone (token-driven; G7). */
const TONE_CLASS: Record<'neutral' | 'warning' | 'danger', string> = {
  neutral: 'text-text-secondary',
  warning: 'text-warning',
  danger: 'text-danger',
};

/** A live, aria-live="polite" character counter beneath a field. */
function CharacterCounter({ length, max, label }: { length: number; max: number; label: string }) {
  const tone = counterTone(length, max);
  return (
    <p aria-live="polite" className={`t-body-sm seo-character-counter ${TONE_CLASS[tone]}`}>
      {label}: {length} / {max}
    </p>
  );
}

export function SeoMetadataEditor({
  value,
  onDone,
}: {
  value: SeoMetadataFormValue;
  onDone?: () => void;
}) {
  const [state, formAction, pending] = useActionState(upsertSeoMetadata, INITIAL_STATE);
  const router = useRouter();
  const baseId = useId();

  const [scope, setScope] = useState(value.scope);
  const [metaTitle, setMetaTitle] = useState(value.metaTitle);
  const [metaDescription, setMetaDescription] = useState(value.metaDescription);
  const [advancedOpen, setAdvancedOpen] = useState(
    value.canonicalUrl.length > 0 || value.structuredData.length > 0,
  );

  const isDefault = scope === 'default';

  useEffect(() => {
    if (state.ok) {
      onDone?.();
      router.refresh();
    }
  }, [state, router, onDone]);

  const errorProps = useMemo(() => {
    const byField = new Map<string, ReactNode>();
    for (const error of state.errors ?? []) {
      if (error.field && !byField.has(error.field)) byField.set(error.field, error.message);
    }
    return (field: string): { error: ReactNode } | Record<string, never> => {
      if (!byField.has(field)) return {};
      return { error: byField.get(field) };
    };
  }, [state]);

  return (
    <form action={formAction} className="flex max-w-[44rem] flex-col gap-6">
      <FormError errors={state.errors ?? []} />
      {state.ok ? <FormSuccess title="SEO settings saved." /> : null}

      <Select
        id={`${baseId}-scope`}
        name="scope"
        label="Applies to"
        options={SCOPE_OPTIONS}
        value={scope}
        onChange={(event) => setScope(event.target.value)}
        hint="Choose the default to set the site-wide fallback, or a single entity to override it."
      />

      {isDefault ? null : (
        <TextField
          id={`${baseId}-scope-id`}
          name="scopeId"
          label="Entity ID"
          hint="The identifier of the page, property, area guide, blog post or branch this override applies to."
          defaultValue={value.scopeId ?? ''}
          {...errorProps('scopeId')}
          required
        />
      )}

      <div className="flex flex-col gap-1">
        <TextField
          id={`${baseId}-meta-title`}
          name="metaTitle"
          label="Meta title"
          hint="Shown as the headline in search results. Aim for 60 characters or fewer."
          value={metaTitle}
          onChange={(event) => setMetaTitle(event.target.value)}
          maxLength={SEO_META_TITLE_MAX}
          {...errorProps('metaTitle')}
        />
        <CharacterCounter length={metaTitle.length} max={SEO_META_TITLE_MAX} label="Title length" />
      </div>

      <div className="flex flex-col gap-1">
        <TextField
          id={`${baseId}-meta-description`}
          name="metaDescription"
          label="Meta description"
          hint="The snippet shown beneath the title in search results. Aim for 160 characters or fewer."
          value={metaDescription}
          onChange={(event) => setMetaDescription(event.target.value)}
          maxLength={SEO_META_DESCRIPTION_MAX}
          {...errorProps('metaDescription')}
        />
        <CharacterCounter
          length={metaDescription.length}
          max={SEO_META_DESCRIPTION_MAX}
          label="Description length"
        />
      </div>

      <section
        aria-label="Search result preview"
        className="border-divider bg-surface-raised flex flex-col gap-1 rounded-md border p-4"
      >
        <span className="t-body-sm text-text-secondary">Search result preview</span>
        <span className="t-body-lg text-link">{metaTitle || 'Your meta title'}</span>
        <span className="t-body-sm text-text-secondary">
          {metaDescription || 'Your meta description will appear here.'}
        </span>
      </section>

      <TextField
        id={`${baseId}-og-image`}
        name="ogImage"
        label="Social share image (Open Graph)"
        hint="The image shown when this page is shared on social media. Leave blank to use the default."
        defaultValue={value.ogImage}
        {...errorProps('ogImage')}
      />

      <fieldset className="flex flex-col gap-3">
        <legend className="t-body-md font-semibold">Search engine visibility</legend>
        <Checkbox
          id={`${baseId}-no-index`}
          name="noIndex"
          label="Hide from search results (noindex)"
          description="This page won't appear in search results. Use sparingly."
          defaultChecked={value.noIndex}
        />
        <Checkbox
          id={`${baseId}-no-follow`}
          name="noFollow"
          label="Don't follow links on this page (nofollow)"
          defaultChecked={value.noFollow}
        />
      </fieldset>

      <div className="flex flex-col gap-3">
        <Button type="button" variant="ghost" onClick={() => setAdvancedOpen((open) => !open)}>
          {advancedOpen ? 'Hide advanced' : 'Show advanced'}
        </Button>
        {advancedOpen ? (
          <div className="flex flex-col gap-6">
            <TextField
              id={`${baseId}-canonical`}
              name="canonicalUrl"
              label="Canonical URL"
              hint="Override the canonical link when this page duplicates another. Leave blank to use the page's own URL."
              defaultValue={value.canonicalUrl}
              {...errorProps('canonicalUrl')}
            />
            <TextField
              id={`${baseId}-structured-data`}
              name="structuredData"
              label="Structured data overrides (JSON)"
              hint="Advanced — JSON-LD fields merged into the emitted schema.org markup. Leave blank for none."
              defaultValue={value.structuredData}
              {...errorProps('structuredData')}
            />
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={pending}>
          Save SEO settings
        </Button>
        {onDone ? (
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
