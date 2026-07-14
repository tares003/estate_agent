'use server';

import { audit, withTenant } from '@estate/db';
import type { FormErrorItem } from '@estate/ui';

import { getDb } from '../../../lib/db.js';
import { isListingTypePermitted } from '../../../lib/packs.js';
import {
  getStaffActor,
  getStaffUserId,
  requireStaffPermission,
} from '../../../lib/staff-session.js';
import { getCurrentTenantId, getRequestIp, getRequestUserAgent } from '../../../lib/tenant.js';
import { activeListingWhere, getTenantActiveListingQuota } from '../../../lib/import-quota.js';
import {
  insertPropertyRow,
  updatePropertyRow,
  type PropertyCreateClient,
} from '../property-insert.js';
import {
  buildMatchIndex,
  formatRowError,
  importMatchField,
  parsePropertyImportCsv,
  planImportRows,
  type ExistingPropertyKey,
  type RowError,
  type RowFieldError,
  type ValidRow,
} from './csv-import-core.js';
import { readImportCsv, readImportMapping, readImportMode } from './read-csv.js';

// EPIC-X FR-X-1 / FR-X-5 / FR-X-6 / FR-X-9 — the audited bulk CSV property-import action.
//
// RBAC fail-closed on `property.import` BEFORE any read/write (FR-X-1 — the dedicated
// bulk-import capability from the @estate/auth catalogue, granted to the same roles
// that hold `property.write`). The uploaded CSV is parsed + validated by
// the pure core; the EPIC-AD / G12 pack gate then fails any row authoring a vertical the
// tenant has not enabled (row-isolated, like a validation failure); every remaining row
// is created through the SHARED `insertPropertyRow` path (identical slug disambiguation,
// column mapping and `property.created` audit as the admin create form); the run is
// recorded as ONE `import_logs` row (source=csv_upload, triggeredBy=<staff id>, the
// in/created/skipped/failed counts, and an errorSummary listing the per-row failures)
// and audited as one `property.imported` run event — all inside a single tenant
// transaction (G4).
//
// FR-X-5 row isolation covers DB-CONSTRAINT failures too: each row insert runs under a
// Postgres SAVEPOINT inside the one tenant transaction. A duplicate `reference` (P2002
// on @@unique([tenantId, reference])) — or any other insert error — rolls back ONLY its
// own savepoint (undoing that row's insert + its property.created audit), is recorded as
// a failed row with its own FR-X-9 audit entry, and the run continues. Savepoints were
// chosen over splitting the run into per-row transactions so the import_log, the run
// audit and every surviving row still commit ATOMICALLY (and RLS's SET LOCAL tenant GUC
// keeps applying to the whole run); a mid-run crash leaves nothing half-imported.
//
// FR-X-2 / FR-X-4 upsert: the form posts an import MODE (create_only | upsert_reference
// | upsert_external_id; absent/unknown falls back to create_only). In an upsert mode the
// action reads the tenant's existing property identities INSIDE the same transaction,
// plans each row with the pure planner the dry-run preview also uses (create / update /
// skip), UPDATES matched rows through the shared `updatePropertyRow` write path (same
// coreData column mapping, `property.updated` audit; slug + provenance untouched) and
// SKIPS rows that carry no external id in external-id mode — creating them would mint a
// duplicate on every re-run, violating the FR-X acceptance criterion. Skipped rows are
// recorded on the log (they are not failures: no per-row audit). The FR-X-10 quota
// counts only NET-NEW published rows (planned creates) — updates are never net-new.
//
// The match index is a PRE-RUN snapshot, so the planner also rejects a row repeating a
// match key an EARLIER row of the same file mints: it is recorded as a failed row (no
// write at all — no savepoint needed), because inserting it would mint the duplicate
// pair `external_id` has no unique constraint to stop.
//
// This is an authenticated admin action over business data, not a public personal-data
// form: no GDPR-consent affirmation (G5) and no Turnstile (G8). Deferred to later slices
// of this epic: image post-processing (FR-X-11) and scheduled feeds (FR-X-7/8).

/** The import source identifier stored on the `import_logs` row (schema doc: "csv_upload"). */
const IMPORT_SOURCE = 'csv_upload';

/** The savepoint name each row insert runs under (re-used per row, released after). */
const ROW_SAVEPOINT = 'property_import_row';

/** The `import_logs` write surface this action needs (a Prisma tx satisfies it). */
interface ImportLogClient extends PropertyCreateClient {
  property: PropertyCreateClient['property'] & {
    /** Count existing active listings for the FR-X-10 quota check (tenant-scoped). */
    count(args: { where?: Record<string, unknown> }): Promise<number>;
    /** Update a matched row on the upsert path (FR-X-4, via `updatePropertyRow`). */
    update(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }): Promise<unknown>;
  };
  importLog: {
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
  };
  /** Raw SQL escape hatch for the per-row SAVEPOINT statements (FR-X-5 isolation). */
  $executeRawUnsafe(query: string): Promise<number>;
}

/** The active-listing quota decision recorded on the run audit (FR-X-10). */
interface QuotaDecision {
  /** The tenant's plan-tier active-listing cap (Infinity for enterprise). */
  limit: number;
  /** Existing active (publicly live) listings before this run. */
  existingActive: number;
  /**
   * NET-NEW published rows: planned CREATES with publicationStatus=published. Drafts
   * never consume the ACTIVE cap, and upsert UPDATES are never net-new (FR-X-10).
   */
  incoming: number;
}

/** The per-run counts surfaced to the admin and stored on the `import_logs` row. */
export interface ImportRunCounts {
  input: number;
  created: number;
  /** Rows that UPDATED an existing listing (upsert mode; always 0 in create-only). */
  updated: number;
  /** Rows skipped unprocessed (upsert on external id, row carried none). */
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
  /** One human-readable line per SKIPPED source row (not failures; upsert mode only). */
  skippedSummary?: string[];
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

/**
 * Describe a row write failure (insert OR upsert-update) as a row-level field error
 * (FR-X-5). A P2002 unique-constraint violation is a duplicate `reference` (slugs are
 * de-duplicated in-run, so the reference unique index is the one a CSV can
 * realistically hit — on update, an external-id-matched row renaming its reference
 * onto another listing's); anything else gets a generic per-row failure line.
 */
function describeWriteError(error: unknown): RowFieldError {
  const code =
    typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
  if (code === 'P2002') {
    return {
      field: 'reference',
      message: 'a property with this reference already exists (duplicate)',
    };
  }
  return { field: '', message: 'the row could not be imported' };
}

export async function importPropertiesFromCsv(
  _prevState: ImportActionState,
  formData: FormData,
): Promise<ImportActionState> {
  // RBAC gate (FR-X-1) — fail closed BEFORE reading the upload or touching the DB.
  try {
    await requireStaffPermission('property.import');
  } catch {
    return deny('You do not have permission to import listings.');
  }

  const upload = await readImportCsv(formData);
  if ('error' in upload) {
    return deny(upload.error);
  }

  // FR-X-3 — the same mapping the admin confirmed in the dry-run preview travels with the
  // real import, so the audited run parses the file identically to the preview.
  const mapping = readImportMapping(formData);

  const parseResult = parsePropertyImportCsv(upload.text, mapping);
  if (parseResult.parseError !== undefined) {
    return deny(parseResult.parseError);
  }

  const tenantId = await getCurrentTenantId();
  const actor = await getStaffActor();
  const triggeredBy = await getStaffUserId();
  // FR-H-17 / FR-N-14 — provenance for every audit row this run writes (the run event,
  // the per-failed-row events, and the per-property events the shared write paths emit)
  // is IP + USER-AGENT, not the IP alone.
  const ip = await getRequestIp();
  const userAgent = await getRequestUserAgent();

  // EPIC-AD / G12 — pack entitlement, enforced SERVER-SIDE on the import path exactly
  // like createProperty: a row authoring a pack-gated vertical the tenant has not
  // enabled is failed (row-isolated, FR-X-5), never inserted. Each distinct listing
  // type is resolved once against the registry.
  const typePermitted = new Map<string, boolean>();
  for (const listingType of new Set(parseResult.valid.map((row) => row.data.listingType))) {
    typePermitted.set(listingType, await isListingTypePermitted(listingType));
  }
  const importable: ValidRow[] = [];
  const packRowErrors: RowError[] = [];
  for (const row of parseResult.valid) {
    if (typePermitted.get(row.data.listingType) === true) {
      importable.push(row);
    } else {
      packRowErrors.push({
        rowNumber: row.rowNumber,
        errors: [
          {
            field: 'listingType',
            message: `the "${row.data.listingType}" listing type requires a pack that is not enabled for this tenant`,
          },
        ],
      });
    }
  }

  // FR-X-2 / FR-X-4 — the import mode the admin chose (defaulting to create-only) and
  // the identity field an upsert matches on (null = no matching).
  const mode = readImportMode(formData);
  const matchField = importMatchField(mode);

  // FR-X-10 — the tenant's plan-tier active-listing cap (Infinity for enterprise),
  // read from the operator registry BEFORE the transaction. The existing active
  // count is taken inside the tx (tenant-scoped/RLS) so the quota is enforced against
  // live data at import time.
  const quotaLimit = await getTenantActiveListingQuota();

  const startedAt = new Date();

  let result: ImportActionState = deny('The import could not be completed.');
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as ImportLogClient;

    // FR-X-4 — in an upsert mode, read the tenant's existing property identities
    // (tenant-scoped/RLS; soft-deleted rows excluded — an import never resurrects a
    // deleted listing) and plan every row with the SAME pure planner the dry-run
    // preview used: create / update / skip. Create-only plans everything as a create.
    // The runtime rows carry id+reference+externalId per the select; the structural
    // client interface types findMany for the slug seed, hence the local cast.
    let index = new Map<string, string>();
    if (matchField !== null) {
      const existingKeys = (await tx.property.findMany({
        where: { deletedAt: null },
        select: { id: true, reference: true, externalId: true },
      })) as unknown as ExistingPropertyKey[];
      index = buildMatchIndex(existingKeys, matchField);
    }
    const plan = planImportRows(importable, matchField, index);

    // FR-X-10 — only rows this run would CREATE as PUBLISHED consume the ACTIVE cap:
    // drafts are not active, and an upsert UPDATE is never net-new (the listing
    // already exists), so re-running an already-imported file consumes no headroom.
    const incoming = plan.filter(
      (planned) =>
        planned.action === 'create' && planned.row.data.publicationStatus === 'published',
    ).length;

    // FR-X-10 — abort BEFORE any insert / import_logs write / audit when this run
    // would push the tenant past their active-listing quota. Nothing is created and
    // nothing is audited, so there is no state change to record (G4 unaffected).
    const existingActive = await tx.property.count({ where: activeListingWhere() });
    if (existingActive + incoming > quotaLimit) {
      const remaining = Math.max(0, quotaLimit - existingActive);
      result = deny(
        `Quota would be exceeded: this import would add ${incoming} active listing(s) to ` +
          `${existingActive} already live, over your plan limit of ${quotaLimit}. ` +
          `You can import up to ${remaining} more, or upgrade your plan.`,
      );
      return;
    }
    const quota: QuotaDecision = { limit: quotaLimit, existingActive, incoming };

    // Seed the slug set from the tenant's existing properties so imported slugs never
    // collide with live rows; `insertPropertyRow` reserves each minted slug as it goes,
    // so successive valid rows in THIS run also stay unique (FR-F-11).
    const existing = await tx.property.findMany({ where: {}, select: { slug: true } });
    const taken = new Set(existing.map((row) => row.slug));

    // FR-X-5 — per-row DB-error isolation. Each row WRITE (insert or upsert-update)
    // runs under a SAVEPOINT: a constraint failure (e.g. duplicate reference, P2002)
    // rolls back ONLY that row (including its property audit event) and the run
    // continues; the surrounding tenant transaction — import_log + run audit +
    // surviving rows — stays intact. Skipped rows perform no write at all.
    const ctx = { tenantId, actor, createdByUserId: triggeredBy, ip, userAgent };
    let created = 0;
    let updated = 0;
    const skippedSummary: string[] = [];
    const writeRowErrors: RowError[] = [];
    for (const planned of plan) {
      if (planned.action === 'skip') {
        skippedSummary.push(`Row ${planned.row.rowNumber} — skipped: ${planned.reason}`);
        continue;
      }
      // FR-X-4 / FR-X-5 — a row the planner already rejected (it repeats a match key an
      // earlier row in the SAME file mints, which would insert a duplicate) is a FAILED
      // row: no write, no savepoint, but the full error-report + per-row audit treatment
      // a DB-constraint failure gets below.
      if (planned.action === 'fail') {
        writeRowErrors.push({ rowNumber: planned.row.rowNumber, errors: [planned.error] });
        continue;
      }
      await tx.$executeRawUnsafe(`SAVEPOINT ${ROW_SAVEPOINT}`);
      try {
        if (planned.action === 'create') {
          await insertPropertyRow(tx, ctx, planned.row.data, taken);
          created += 1;
        } else {
          // FR-X-4 — the matched row updates through the SHARED write path (same
          // coreData column mapping + property.updated audit as the admin edit).
          await updatePropertyRow(
            tx,
            ctx,
            planned.row.data,
            { id: planned.propertyId },
            planned.matchedOn,
          );
          updated += 1;
        }
      } catch (error) {
        await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${ROW_SAVEPOINT}`);
        writeRowErrors.push({
          rowNumber: planned.row.rowNumber,
          errors: [describeWriteError(error)],
        });
      }
      await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${ROW_SAVEPOINT}`);
    }

    // Every failed row — validation, pack gate, or DB constraint — in source order.
    const rowErrors = [...parseResult.errors, ...packRowErrors, ...writeRowErrors].sort(
      (a, b) => a.rowNumber - b.rowNumber,
    );
    const errorSummary = summariseErrors(rowErrors);

    const counts: ImportRunCounts = {
      input: parseResult.recordsInput,
      created,
      updated,
      // Skipped = left unprocessed by design (upsert on external id, row carried
      // none). Rows that failed validation, the pack gate or a DB constraint are
      // `failed`, not skipped.
      skipped: skippedSummary.length,
      failed: rowErrors.length,
    };

    const importLog = await tx.importLog.create({
      data: {
        tenantId,
        source: IMPORT_SOURCE,
        triggeredBy,
        recordsInput: counts.input,
        recordsCreated: counts.created,
        recordsUpdated: counts.updated,
        recordsSkipped: counts.skipped,
        recordsFailed: counts.failed,
        errorSummary:
          errorSummary.length > 0 || skippedSummary.length > 0
            ? {
                rows: errorSummary,
                ...(skippedSummary.length > 0 ? { skipped: skippedSummary } : {}),
              }
            : null,
        startedAt,
        finishedAt: new Date(),
      },
    });

    // FR-X-9 — one audit entry per import run (the run summary). Each created property
    // additionally emits its own `property.created` row via `insertPropertyRow`, and
    // each updated property its own `property.updated` row via `updatePropertyRow`.
    await audit(tx, {
      tenantId,
      actor,
      action: 'property.imported',
      entity: 'import_log',
      entityId: importLog.id,
      // FR-X-10 — the quota decision travels on the run audit so an import is traceable
      // to the cap it was checked against and the headroom it consumed; `mode` records
      // the FR-X-2 choice the run executed (the import_logs table carries no column).
      diff: { source: IMPORT_SOURCE, mode, ...counts, quota },
      ip,
      userAgent,
    });

    // FR-X-9 — PLUS one audit entry per FAILED row (validation, pack gate or DB
    // constraint alike), so each rejected row is traceable to its run and reason (the
    // run summary alone does not name the individual failures). All emitted inside the
    // same tenant transaction as the run event.
    for (const rowError of rowErrors) {
      await audit(tx, {
        tenantId,
        actor,
        action: 'property.import_row_failed',
        entity: 'import_log',
        entityId: importLog.id,
        diff: { rowNumber: rowError.rowNumber, error: formatRowError(rowError) },
        ip,
        userAgent,
      });
    }

    result = {
      ok: true,
      importLogId: importLog.id,
      counts,
      ...(errorSummary.length > 0 ? { errorSummary } : {}),
      ...(skippedSummary.length > 0 ? { skippedSummary } : {}),
      ...(parseResult.ignoredColumns.length > 0
        ? { ignoredColumns: parseResult.ignoredColumns }
        : {}),
    };
  });
  return result;
}
