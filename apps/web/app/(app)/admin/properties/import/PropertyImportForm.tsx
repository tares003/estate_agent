'use client';

import { useActionState } from 'react';
import { Badge, Button, FormError, FormSuccess } from '@estate/ui';

import { importPropertiesFromCsv, type ImportActionState } from './actions.js';
import { IMPORT_COLUMNS } from './csv-import-core.js';

// EPIC-X FR-X-1 — the admin CSV bulk-import form. A single file input posts the upload
// to the audited `importPropertiesFromCsv` action; on success it shows the ImportLog
// result — the created / skipped / failed counts as tokened pills (design brief §Token
// references) and the per-row error summary. Token-driven classes only (G7). The
// column-mapping wizard (FR-X-2/3) is a later slice; V1 documents the header convention
// inline so a content editor can shape their CSV without a mapping step.

const INITIAL_STATE: ImportActionState = { ok: false };

export function PropertyImportForm() {
  const [state, formAction, pending] = useActionState(importPropertiesFromCsv, INITIAL_STATE);

  return (
    <form action={formAction} className="flex max-w-[46rem] flex-col gap-6">
      <FormError errors={state.errors ?? []} />

      <div className="flex flex-col gap-2">
        <label htmlFor="import-file" className="t-body-md font-semibold">
          Property CSV
        </label>
        <input
          id="import-file"
          name="file"
          type="file"
          accept=".csv,text/csv"
          className="t-body-sm text-text-secondary"
          aria-describedby="import-file-hint"
        />
        <span id="import-file-hint" className="t-body-sm text-text-secondary">
          A UTF-8 CSV whose header row uses the field names below. The first row is the header. Up
          to 5&nbsp;MB — larger catalogues use a scheduled feed.
        </span>
      </div>

      <div>
        <Button type="submit" loading={pending}>
          Import properties
        </Button>
      </div>

      {state.ok && state.counts ? (
        <section aria-labelledby="import-result-heading" className="flex flex-col gap-4">
          <FormSuccess title="Import complete." />
          <h2 id="import-result-heading" className="t-title-sm">
            Run summary
          </h2>
          <dl className="flex flex-wrap items-center gap-3" aria-label="Import counts">
            <div className="flex items-center gap-2">
              <dt className="t-body-sm text-text-secondary">Records read</dt>
              <dd>
                <Badge tone="neutral">{state.counts.input}</Badge>
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="t-body-sm text-text-secondary">Created</dt>
              <dd>
                <Badge tone="success">{state.counts.created}</Badge>
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="t-body-sm text-text-secondary">Skipped</dt>
              <dd>
                <Badge tone="neutral">{state.counts.skipped}</Badge>
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="t-body-sm text-text-secondary">Failed</dt>
              <dd>
                <Badge tone={state.counts.failed > 0 ? 'danger' : 'neutral'}>
                  {state.counts.failed}
                </Badge>
              </dd>
            </div>
          </dl>

          {state.ignoredColumns && state.ignoredColumns.length > 0 ? (
            <p className="t-body-sm text-text-secondary">
              Ignored unrecognised columns: {state.ignoredColumns.join(', ')}.
            </p>
          ) : null}

          {state.errorSummary && state.errorSummary.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h3 className="t-body-md font-semibold">Rows that could not be imported</h3>
              <ul className="border-divider flex flex-col gap-1 rounded-lg border p-4">
                {state.errorSummary.map((line, index) => (
                  <li key={index} className="t-body-sm text-text-secondary">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      <details className="flex flex-col gap-2">
        <summary className="t-body-sm cursor-pointer font-semibold">Expected CSV columns</summary>
        <p className="t-body-sm text-text-secondary max-w-[55ch]">
          Use these header names. <code>reference</code>, <code>listingType</code>,{' '}
          <code>saleType</code>, <code>displayAddress</code> and <code>postcode</code> are required;
          the rest are optional. Any other column is ignored.
        </p>
        <ul className="flex flex-wrap gap-2">
          {IMPORT_COLUMNS.map((column) => (
            <li key={column}>
              <Badge tone="neutral">{column}</Badge>
            </li>
          ))}
        </ul>
      </details>
    </form>
  );
}
