'use client';

import { useActionState, useState } from 'react';
import { Badge, Button, FormError, FormSuccess } from '@estate/ui';

import { importPropertiesFromCsv, type ImportActionState } from './actions.js';
import { previewPropertyImport, type ImportPreviewState } from './preview-action.js';
import { IMPORT_COLUMNS } from './csv-import-core.js';

// EPIC-X FR-X-1 / FR-X-2 — the admin CSV bulk-import form with a DRY-RUN preview step.
//
// The admin never creates listings on the first click. The primary action posts the
// upload to the dry-run `previewPropertyImport` action (which writes NOTHING) and the
// form shows the outcome: total records detected, valid / invalid counts, a sample of
// the first records mapped to canonical attributes, and the per-row validation errors.
// Only when the admin presses "Confirm and import" does the SAME file post to the
// audited `importPropertiesFromCsv` action, which creates the properties and records the
// run. "Cancel" discards the preview and returns to the upload step.
//
// Both submissions share one hidden file input inside one form: the primary submit
// button triggers the preview action, the confirm button (a `formAction` override)
// triggers the real import — so the file is submitted once, previewed, then committed
// without re-selecting it. Token-driven classes only (G7).

const INITIAL_PREVIEW_STATE: ImportPreviewState = { ok: false };
const INITIAL_IMPORT_STATE: ImportActionState = { ok: false };

export function PropertyImportForm() {
  const [previewState, previewAction, previewPending] = useActionState(
    previewPropertyImport,
    INITIAL_PREVIEW_STATE,
  );
  const [importState, importAction, importPending] = useActionState(
    importPropertiesFromCsv,
    INITIAL_IMPORT_STATE,
  );

  // Lets the admin dismiss a shown preview and start over without a completed import.
  const [cancelled, setCancelled] = useState(false);

  const preview = previewState.ok ? previewState.preview : undefined;
  const showPreview = preview !== undefined && !cancelled && !importState.ok;

  return (
    <form action={previewAction} className="flex max-w-[46rem] flex-col gap-6">
      <FormError errors={previewState.errors ?? []} />
      <FormError errors={importState.errors ?? []} />

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
          onChange={() => setCancelled(false)}
        />
        <span id="import-file-hint" className="t-body-sm text-text-secondary">
          A UTF-8 CSV whose header row uses the field names below. The first row is the header. Up
          to 5&nbsp;MB — larger catalogues use a scheduled feed.
        </span>
      </div>

      {!importState.ok ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={previewPending}>
            Preview import
          </Button>
          {showPreview ? (
            <>
              <Button
                type="submit"
                variant="primary"
                formAction={importAction}
                loading={importPending}
              >
                Confirm and import
              </Button>
              <Button type="button" variant="ghost" onClick={() => setCancelled(true)}>
                Cancel
              </Button>
            </>
          ) : null}
        </div>
      ) : null}

      {showPreview ? (
        <section aria-labelledby="import-preview-heading" className="flex flex-col gap-4">
          <h2 id="import-preview-heading" className="t-title-sm">
            Dry-run preview
          </h2>
          <p className="t-body-sm text-text-secondary max-w-[60ch]">
            Nothing has been created yet. Check the counts and the sample below, then confirm to
            import.
          </p>
          <dl className="flex flex-wrap items-center gap-3" aria-label="Preview counts">
            <div className="flex items-center gap-2">
              <dt className="t-body-sm text-text-secondary">Records detected</dt>
              <dd>
                <Badge tone="neutral">{preview.counts.input}</Badge>
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="t-body-sm text-text-secondary">Valid</dt>
              <dd>
                <Badge tone="success">{preview.counts.valid}</Badge>
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="t-body-sm text-text-secondary">Invalid</dt>
              <dd>
                <Badge tone={preview.counts.invalid > 0 ? 'danger' : 'neutral'}>
                  {preview.counts.invalid}
                </Badge>
              </dd>
            </div>
          </dl>

          {preview.sample.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h3 className="t-body-md font-semibold">Sample (first {preview.sample.length})</h3>
              <ul className="border-divider flex flex-col gap-2 rounded-lg border p-4">
                {preview.sample.map((row) => (
                  <li key={row.reference} className="t-body-sm flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">{row.reference}</Badge>
                    <span className="text-text-secondary">{row.displayAddress}</span>
                    {row.price !== null ? (
                      <span className="text-text-secondary">Guide price £{row.price}</span>
                    ) : null}
                    <span className="text-text-secondary">{row.listingType}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {preview.ignoredColumns.length > 0 ? (
            <p className="t-body-sm text-text-secondary">
              Ignored unrecognised columns: {preview.ignoredColumns.join(', ')}.
            </p>
          ) : null}

          {preview.errors.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h3 className="t-body-md font-semibold">Rows that would be rejected</h3>
              <ul className="border-divider flex flex-col gap-1 rounded-lg border p-4">
                {preview.errors.map((line, index) => (
                  <li key={index} className="t-body-sm text-text-secondary">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {importState.ok && importState.counts ? (
        <section aria-labelledby="import-result-heading" className="flex flex-col gap-4">
          <FormSuccess title="Import complete." />
          <h2 id="import-result-heading" className="t-title-sm">
            Run summary
          </h2>
          <dl className="flex flex-wrap items-center gap-3" aria-label="Import counts">
            <div className="flex items-center gap-2">
              <dt className="t-body-sm text-text-secondary">Records read</dt>
              <dd>
                <Badge tone="neutral">{importState.counts.input}</Badge>
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="t-body-sm text-text-secondary">Created</dt>
              <dd>
                <Badge tone="success">{importState.counts.created}</Badge>
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="t-body-sm text-text-secondary">Skipped</dt>
              <dd>
                <Badge tone="neutral">{importState.counts.skipped}</Badge>
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="t-body-sm text-text-secondary">Failed</dt>
              <dd>
                <Badge tone={importState.counts.failed > 0 ? 'danger' : 'neutral'}>
                  {importState.counts.failed}
                </Badge>
              </dd>
            </div>
          </dl>

          {importState.ignoredColumns && importState.ignoredColumns.length > 0 ? (
            <p className="t-body-sm text-text-secondary">
              Ignored unrecognised columns: {importState.ignoredColumns.join(', ')}.
            </p>
          ) : null}

          {importState.errorSummary && importState.errorSummary.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h3 className="t-body-md font-semibold">Rows that could not be imported</h3>
              <ul className="border-divider flex flex-col gap-1 rounded-lg border p-4">
                {importState.errorSummary.map((line, index) => (
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
