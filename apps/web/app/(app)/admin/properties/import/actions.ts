'use server';

import { audit, withTenant } from '@estate/db';
import type { FormErrorItem } from '@estate/ui';

import { getDb } from '../../../lib/db.js';
import {
  getStaffActor,
  getStaffUserId,
  requireStaffPermission,
} from '../../../lib/staff-session.js';
import { getCurrentTenantId, getRequestIp } from '../../../lib/tenant.js';
import { insertPropertyRow, type PropertyCreateClient } from '../actions.js';
import { formatRowError, parsePropertyImportCsv, type RowError } from './csv-import-core.js';
import { readImportCsv } from './read-csv.js';

// EPIC-X FR-X-1 / FR-X-6 / FR-X-9 — the audited bulk CSV property-import action.
//
// RBAC fail-closed on `property.write` BEFORE any read/write (the same permission the
// property create action gates on — `property.import` is not yet in the catalogue, and
// this slice reuses the create path verbatim). The uploaded CSV is parsed + validated by
// the pure core; every VALID row is created through the SHARED `insertPropertyRow` path
// (identical slug disambiguation, column mapping and `property.created` audit as the
// admin create form); the run is recorded as ONE `import_logs` row (source=csv_upload,
// triggeredBy=<staff id>, the in/created/skipped/failed counts, and an errorSummary
// listing the per-row failures) and audited as one `property.imported` run event — all
// inside a single tenant transaction (G4).
//
// This is an authenticated admin action over business data, not a public personal-data
// form: no GDPR-consent affirmation (G5) and no Turnstile (G8). Deferred to later slices
// of this epic: the dry-run preview (FR-X-2), configurable / preset CRM column mappings
// (FR-X-3), upsert + external-id matching (FR-X-4/5), plan-quota enforcement (FR-X-10),
// image post-processing (FR-X-11) and scheduled feeds (FR-X-7/8).

/** The import source identifier stored on the `import_logs` row (schema doc: "csv_upload"). */
const IMPORT_SOURCE = 'csv_upload';

/** The `import_logs` write surface this action needs (a Prisma tx satisfies it). */
interface ImportLogClient extends PropertyCreateClient {
  importLog: {
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
  };
}

/** The per-run counts surfaced to the admin and stored on the `import_logs` row. */
export interface ImportRunCounts {
  input: number;
  created: number;
  skipped: number;
  failed: number;
}

/** The result of a bulk import, consumed by `useActionState`. */
export interface ImportActionState {
  ok: boolean;
  errors?: FormErrorItem[];
  /** The persisted `import_logs` row id (so the admin can link to the run). */
  importLogId?: string;
  counts?: ImportRunCounts;
  /** One human-readable line per failed source row (the downloadable-report seed). */
  errorSummary?: string[];
  /** Headers present in the file the importer did not recognise (ignored). */
  ignoredColumns?: string[];
}

function deny(message: string): ImportActionState {
  return { ok: false, errors: [{ message }] };
}

/** Build the stored + displayed error summary lines from the failed rows. */
function summariseErrors(rowErrors: RowError[]): string[] {
  return rowErrors.map(formatRowError);
}

export async function importPropertiesFromCsv(
  _prevState: ImportActionState,
  formData: FormData,
): Promise<ImportActionState> {
  // RBAC gate — fail closed BEFORE reading the upload or touching the DB.
  try {
    await requireStaffPermission('property.write');
  } catch {
    return deny('You do not have permission to import listings.');
  }

  const upload = await readImportCsv(formData);
  if ('error' in upload) {
    return deny(upload.error);
  }

  const parseResult = parsePropertyImportCsv(upload.text);
  if (parseResult.parseError !== undefined) {
    return deny(parseResult.parseError);
  }

  const tenantId = await getCurrentTenantId();
  const actor = await getStaffActor();
  const triggeredBy = await getStaffUserId();
  const ip = await getRequestIp();

  const errorSummary = summariseErrors(parseResult.errors);
  const startedAt = new Date();

  let result: ImportActionState = deny('The import could not be completed.');
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as ImportLogClient;

    // Seed the slug set from the tenant's existing properties so imported slugs never
    // collide with live rows; `insertPropertyRow` reserves each minted slug as it goes,
    // so successive valid rows in THIS run also stay unique (FR-F-11).
    const existing = await tx.property.findMany({ where: {}, select: { slug: true } });
    const taken = new Set(existing.map((row) => row.slug));

    let created = 0;
    for (const row of parseResult.valid) {
      await insertPropertyRow(
        tx,
        { tenantId, actor, createdByUserId: triggeredBy, ip },
        row.data,
        taken,
      );
      created += 1;
    }

    const counts: ImportRunCounts = {
      input: parseResult.recordsInput,
      created,
      // No row was skipped as a duplicate in this create-only slice; upsert de-dup
      // (FR-X-4) is a later slice. Rows that failed validation are `failed`, not skipped.
      skipped: 0,
      failed: parseResult.errors.length,
    };

    const importLog = await tx.importLog.create({
      data: {
        tenantId,
        source: IMPORT_SOURCE,
        triggeredBy,
        recordsInput: counts.input,
        recordsCreated: counts.created,
        recordsUpdated: 0,
        recordsSkipped: counts.skipped,
        recordsFailed: counts.failed,
        errorSummary: errorSummary.length > 0 ? { rows: errorSummary } : null,
        startedAt,
        finishedAt: new Date(),
      },
    });

    // FR-X-9 — one audit entry per import run (the run summary). Each created property
    // additionally emits its own `property.created` row via `insertPropertyRow`.
    await audit(tx, {
      tenantId,
      actor,
      action: 'property.imported',
      entity: 'import_log',
      entityId: importLog.id,
      diff: { source: IMPORT_SOURCE, ...counts },
      ip,
    });

    // FR-X-9 — PLUS one audit entry per FAILED row, so each rejected row is traceable
    // to its run and reason (the run summary alone does not name the individual
    // failures). All emitted inside the same tenant transaction as the run event.
    for (const rowError of parseResult.errors) {
      await audit(tx, {
        tenantId,
        actor,
        action: 'property.import_row_failed',
        entity: 'import_log',
        entityId: importLog.id,
        diff: { rowNumber: rowError.rowNumber, error: formatRowError(rowError) },
        ip,
      });
    }

    result = {
      ok: true,
      importLogId: importLog.id,
      counts,
      ...(errorSummary.length > 0 ? { errorSummary } : {}),
      ...(parseResult.ignoredColumns.length > 0
        ? { ignoredColumns: parseResult.ignoredColumns }
        : {}),
    };
  });
  return result;
}
