import { audit } from '@estate/db';
import { variantKey } from '@estate/storage';

// EPIC-F image post-processing (FR-F-7) — the second workers queue. Re-encodes
// every newly uploaded PropertyImage to strip EXIF (location / device / ownership
// metadata — the privacy half), records the true pixel dimensions, and renders
// the thumb + large variants beside the original under a key convention
// (`<key>.thumb.<ext>` / `<key>.large.<ext>`; nothing in the DB references them,
// so serving can adopt them incrementally).
//
// Discovery is an outbox scan, like the email dispatcher: the schema commits
// `width`/`height` as "populated by the post-process job", so `width IS NULL` is
// the unprocessed marker — no schema change, no web→Redis coupling. Tenancy: the
// tick lists the (un-RLS'd) tenant registry and processes EACH tenant inside its
// own tenant scope. Idempotency (README discipline): the work itself is
// idempotent (re-processing overwrites the same artifacts), and the MARK is an
// atomic compare-and-set on `width IS NULL` — a raced second worker marks nothing
// and audits nothing (G4: one audit row per outcome). Bytes that cannot be
// transformed (a corrupt upload) are POISONED with width/height 0 so they are
// never retried forever, audited as process_failed.

/** The columns the processor reads from an unprocessed gallery row. */
export interface UnprocessedImageRow {
  id: string;
  url: string;
}

/** The structural client the processor needs (a tenant-scoped Prisma tx satisfies it). */
export interface ImageQueueClient {
  propertyImage: {
    findMany(args: {
      where?: Record<string, unknown>;
      orderBy?: unknown;
      take?: number;
    }): Promise<UnprocessedImageRow[]>;
    updateMany(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }): Promise<{ count: number }>;
  };
  auditLog: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
}

/** Run `fn` inside the tenant's RLS scope (bound to one tenant by the caller). */
export type ImageTenantRunner = <T>(fn: (tx: ImageQueueClient) => Promise<T>) => Promise<T>;

/** The byte-level transform (the sharp binding satisfies it; tests inject fakes). */
export type ImageTransform = (input: Buffer) => Promise<{
  data: Buffer;
  width: number;
  height: number;
  thumb: Buffer;
  large: Buffer;
}>;

/** The storage surface the processor needs. */
export interface ImageStore {
  get(key: string): Promise<Buffer>;
  put(key: string, data: Buffer | Uint8Array, opts?: { contentType?: string }): Promise<void>;
}

const DEFAULT_BATCH = 10;

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

function extensionOf(key: string): string {
  return key.slice(key.lastIndexOf('.') + 1).toLowerCase();
}

// The rendition key convention lives in @estate/storage (shared with the app's
// serving side); re-exported so this module remains the processor's one surface.
export { variantKey };

/** Read the oldest gallery rows that have no recorded dimensions yet. */
export async function listUnprocessedImages(
  tx: ImageQueueClient,
  limit: number,
): Promise<UnprocessedImageRow[]> {
  return tx.propertyImage.findMany({
    where: { width: null },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
}

/** Atomically mark a processed row (only while still unprocessed) and audit (G4). */
export async function markImageProcessed(
  tx: ImageQueueClient,
  input: { tenantId: string; id: string; width: number; height: number },
): Promise<boolean> {
  const { count } = await tx.propertyImage.updateMany({
    where: { id: input.id, width: null },
    data: { width: input.width, height: input.height },
  });
  if (count !== 1) return false;
  await audit(tx, {
    tenantId: input.tenantId,
    actor: 'worker:image-processing',
    action: 'property_image.processed',
    entity: 'property_image',
    entityId: input.id,
  });
  return true;
}

/** Poison an untransformable row (width/height 0 — never retried) and audit (G4). */
export async function markImageFailed(
  tx: ImageQueueClient,
  input: { tenantId: string; id: string },
): Promise<void> {
  const { count } = await tx.propertyImage.updateMany({
    where: { id: input.id, width: null },
    data: { width: 0, height: 0 },
  });
  if (count !== 1) return;
  await audit(tx, {
    tenantId: input.tenantId,
    actor: 'worker:image-processing',
    action: 'property_image.process_failed',
    entity: 'property_image',
    entityId: input.id,
  });
}

/** Per-tenant processing outcome counts. */
export interface ProcessCounts {
  processed: number;
  failed: number;
}

/** Process one tenant's unprocessed gallery images. */
export async function processTenantImages(opts: {
  tenantId: string;
  runTenant: ImageTenantRunner;
  backend: ImageStore;
  transform: ImageTransform;
  limit?: number;
}): Promise<ProcessCounts> {
  const { tenantId, runTenant, backend, transform } = opts;
  const limit = opts.limit ?? DEFAULT_BATCH;
  const counts: ProcessCounts = { processed: 0, failed: 0 };

  const rows = await runTenant((tx) => listUnprocessedImages(tx, limit));

  for (const row of rows) {
    try {
      const input = await backend.get(row.url);
      const result = await transform(input);
      const contentType = CONTENT_TYPES[extensionOf(row.url)];
      const putOpts = contentType === undefined ? {} : { contentType };
      await backend.put(row.url, result.data, putOpts);
      await backend.put(variantKey(row.url, 'thumb'), result.thumb, putOpts);
      await backend.put(variantKey(row.url, 'large'), result.large, putOpts);
      await runTenant((tx) =>
        markImageProcessed(tx, {
          tenantId,
          id: row.id,
          width: result.width,
          height: result.height,
        }),
      );
      counts.processed += 1;
    } catch {
      await runTenant((tx) => markImageFailed(tx, { tenantId, id: row.id }));
      counts.failed += 1;
    }
  }

  return counts;
}

/** One tick's totals across every active tenant. */
export interface ImageTickCounts extends ProcessCounts {
  tenants: number;
}

/** Process every active tenant's queue, each inside its own tenant scope. */
export async function runImageTick(deps: {
  listActiveTenants(): Promise<Array<{ id: string }>>;
  runTenantFor(tenantId: string): ImageTenantRunner;
  backend: ImageStore;
  transform: ImageTransform;
  limit?: number;
}): Promise<ImageTickCounts> {
  const tenants = await deps.listActiveTenants();
  const totals: ImageTickCounts = { tenants: tenants.length, processed: 0, failed: 0 };

  for (const tenant of tenants) {
    const counts = await processTenantImages({
      tenantId: tenant.id,
      runTenant: deps.runTenantFor(tenant.id),
      backend: deps.backend,
      transform: deps.transform,
      ...(deps.limit !== undefined ? { limit: deps.limit } : {}),
    });
    totals.processed += counts.processed;
    totals.failed += counts.failed;
  }

  return totals;
}
