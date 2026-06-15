import { audit } from '@estate/db';
import type { SmsBackend } from '@estate/sms';

// EPIC-U / FR-G-3 — the SMS half of the notification_logs outbox. Structurally
// identical to the email dispatcher (notification-dispatcher.ts): per-tenant
// scope, oldest-first batch, ATOMIC claim (queued → processing) for idempotency,
// send OUTSIDE the DB transaction, finalize (sent/failed) + audit per row (G4).
// SMS bodies are short plain text rendered from a code-level registry. When the
// operator has not configured Twilio the backend is null and the row fails (the
// alert is best-effort; the email path and the ticket record are unaffected).

/** A queued SMS row. */
export interface QueuedSmsRow {
  id: string;
  event: string;
  recipient: string;
  payload: unknown;
}

/** The structural client the dispatcher needs (a tenant-scoped Prisma tx satisfies it). */
export interface SmsQueueClient {
  notificationLog: {
    findMany(args: {
      where?: Record<string, unknown>;
      orderBy?: unknown;
      take?: number;
    }): Promise<QueuedSmsRow[]>;
    updateMany(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }): Promise<{ count: number }>;
    update(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }): Promise<unknown>;
  };
  auditLog: { create(args: { data: Record<string, unknown> }): Promise<unknown> };
}

export type SmsTenantRunner = <T>(fn: (tx: SmsQueueClient) => Promise<T>) => Promise<T>;

const DEFAULT_BATCH = 20;

/** Pull the scalar values out of a queued row's JSON payload. */
function values(payload: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof payload === 'object' && payload !== null) {
    for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
      if (typeof value === 'string' || typeof value === 'number') out[key] = String(value);
    }
  }
  return out;
}

/** Plain-text SMS templates, keyed by event. Unknown events render null. */
const TEMPLATES: Record<string, (v: Record<string, string>) => string> = {
  'repair_request.emergency': (v) =>
    `Your emergency repair has been logged as ${v['reference'] ?? ''}. ` +
    `The team has been alerted and will be in touch urgently.`,
};

/** Render the SMS text for a queued event, or null when no template exists. */
export function renderSms(event: string, payload: unknown): string | null {
  const template = TEMPLATES[event];
  return template ? template(values(payload)) : null;
}

/** Read the oldest queued SMS rows, up to the batch limit. */
export async function listQueuedSms(tx: SmsQueueClient, limit: number): Promise<QueuedSmsRow[]> {
  return tx.notificationLog.findMany({
    where: { status: 'queued', channel: 'sms' },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
}

/** Atomically claim a queued row (queued → processing). False when already taken. */
async function claim(tx: SmsQueueClient, id: string): Promise<boolean> {
  const { count } = await tx.notificationLog.updateMany({
    where: { id, status: 'queued' },
    data: { status: 'processing' },
  });
  return count === 1;
}

/** Mark a claimed row's outcome and write the matching audit row (G4). */
async function finalize(
  tx: SmsQueueClient,
  input: { tenantId: string; id: string; status: 'sent' | 'failed' },
): Promise<void> {
  await tx.notificationLog.update({ where: { id: input.id }, data: { status: input.status } });
  await audit(tx, {
    tenantId: input.tenantId,
    actor: 'worker:sms-send',
    action: input.status === 'sent' ? 'notification.sent' : 'notification.failed',
    entity: 'notification_log',
    entityId: input.id,
  });
}

export interface SmsCounts {
  sent: number;
  failed: number;
  skipped: number;
}

/** Dispatch one tenant's queued SMS. */
export async function dispatchTenantSms(opts: {
  tenantId: string;
  runTenant: SmsTenantRunner;
  backend: SmsBackend | null;
  limit?: number;
}): Promise<SmsCounts> {
  const { tenantId, runTenant, backend } = opts;
  const limit = opts.limit ?? DEFAULT_BATCH;
  const counts: SmsCounts = { sent: 0, failed: 0, skipped: 0 };

  const rows = await runTenant((tx) => listQueuedSms(tx, limit));
  for (const row of rows) {
    const claimed = await runTenant((tx) => claim(tx, row.id));
    if (!claimed) {
      counts.skipped += 1;
      continue;
    }
    const text = renderSms(row.event, row.payload);
    if (backend === null || text === null) {
      await runTenant((tx) => finalize(tx, { tenantId, id: row.id, status: 'failed' }));
      counts.failed += 1;
      continue;
    }
    try {
      await backend.send(row.recipient, text);
      await runTenant((tx) => finalize(tx, { tenantId, id: row.id, status: 'sent' }));
      counts.sent += 1;
    } catch {
      await runTenant((tx) => finalize(tx, { tenantId, id: row.id, status: 'failed' }));
      counts.failed += 1;
    }
  }
  return counts;
}

export interface SmsTickCounts extends SmsCounts {
  tenants: number;
}

/** Dispatch every active tenant's queued SMS, each in its own tenant scope. */
export async function runSmsTick(deps: {
  listActiveTenants(): Promise<Array<{ id: string }>>;
  runTenantFor(tenantId: string): SmsTenantRunner;
  resolveBackend(): SmsBackend | null;
  limit?: number;
}): Promise<SmsTickCounts> {
  const tenants = await deps.listActiveTenants();
  const backend = deps.resolveBackend();
  const totals: SmsTickCounts = { tenants: tenants.length, sent: 0, failed: 0, skipped: 0 };
  for (const tenant of tenants) {
    const counts = await dispatchTenantSms({
      tenantId: tenant.id,
      runTenant: deps.runTenantFor(tenant.id),
      backend,
      ...(deps.limit !== undefined ? { limit: deps.limit } : {}),
    });
    totals.sent += counts.sent;
    totals.failed += counts.failed;
    totals.skipped += counts.skipped;
  }
  return totals;
}
