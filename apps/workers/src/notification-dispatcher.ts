import { audit } from '@estate/db';
import type { Mailer } from '@estate/email';

import type { RenderedNotification } from './notification-templates.js';

// EPIC-U email-send — the notification_logs outbox dispatcher (master spec §H.13,
// FR-G-3). notify() records intent (status `queued`); this worker delivers it.
//
// Tenancy: notification_logs is FORCE-RLS'd, so there is no cross-tenant scan —
// the tick lists the (un-RLS'd) tenant registry and dispatches EACH tenant inside
// its own tenant scope (the same SET LOCAL extension apps/web uses, per the
// apps/workers README). Idempotency: a row is CLAIMED with an atomic
// compare-and-set (queued → processing) before any send — a replayed job, or a
// second worker, simply finds nothing to claim and skips. The send itself happens
// OUTSIDE the claim transaction (SMTP I/O never holds a DB transaction open); a
// crash between send and finalize leaves the row in `processing` for manual
// review rather than risking a double-send. Every finalize writes an audit row in
// the same client call (G4 / README discipline). A tenant with no SMTP configured
// or an event with no template fails the row (logged + audited) rather than
// blocking the queue head forever.

/** The queued columns the dispatcher reads. */
export interface QueuedNotificationRow {
  id: string;
  event: string;
  recipient: string;
  payload: unknown;
}

/** The structural client the dispatcher needs (a tenant-scoped Prisma tx satisfies it). */
export interface NotificationQueueClient {
  notificationLog: {
    findMany(args: {
      where?: Record<string, unknown>;
      orderBy?: unknown;
      take?: number;
    }): Promise<QueuedNotificationRow[]>;
    updateMany(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }): Promise<{ count: number }>;
    update(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }): Promise<unknown>;
  };
  auditLog: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
}

/** Run `fn` inside the tenant's RLS scope (bound to one tenant by the caller). */
export type TenantRunner = <T>(fn: (tx: NotificationQueueClient) => Promise<T>) => Promise<T>;

/** Render a queued event to a message, or null when no template exists. */
export type NotificationRenderer = (event: string, payload: unknown) => RenderedNotification | null;

const DEFAULT_BATCH = 20;

/** Read the oldest queued email rows, up to the batch limit. */
export async function listQueuedNotifications(
  tx: NotificationQueueClient,
  limit: number,
): Promise<QueuedNotificationRow[]> {
  return tx.notificationLog.findMany({
    where: { status: 'queued', channel: 'email' },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
}

/** Atomically claim a queued row (queued → processing). False when already taken. */
export async function claimNotification(tx: NotificationQueueClient, id: string): Promise<boolean> {
  const { count } = await tx.notificationLog.updateMany({
    where: { id, status: 'queued' },
    data: { status: 'processing' },
  });
  return count === 1;
}

/** Mark a claimed row's outcome and write the matching audit row (G4). */
export async function finalizeNotification(
  tx: NotificationQueueClient,
  input: { tenantId: string; id: string; status: 'sent' | 'failed' },
): Promise<void> {
  await tx.notificationLog.update({ where: { id: input.id }, data: { status: input.status } });
  await audit(tx, {
    tenantId: input.tenantId,
    actor: 'worker:email-send',
    action: input.status === 'sent' ? 'notification.sent' : 'notification.failed',
    entity: 'notification_log',
    entityId: input.id,
  });
}

/** Per-tenant dispatch outcome counts. */
export interface DispatchCounts {
  sent: number;
  failed: number;
  skipped: number;
}

/** Dispatch one tenant's queued email notifications. */
export async function dispatchTenantNotifications(opts: {
  tenantId: string;
  runTenant: TenantRunner;
  mailer: Mailer | null;
  render: NotificationRenderer;
  limit?: number;
}): Promise<DispatchCounts> {
  const { tenantId, runTenant, mailer, render } = opts;
  const limit = opts.limit ?? DEFAULT_BATCH;
  const counts: DispatchCounts = { sent: 0, failed: 0, skipped: 0 };

  const rows = await runTenant((tx) => listQueuedNotifications(tx, limit));

  for (const row of rows) {
    const claimed = await runTenant((tx) => claimNotification(tx, row.id));
    if (!claimed) {
      counts.skipped += 1;
      continue;
    }

    const message = render(row.event, row.payload);
    if (mailer === null || message === null) {
      await runTenant((tx) => finalizeNotification(tx, { tenantId, id: row.id, status: 'failed' }));
      counts.failed += 1;
      continue;
    }

    try {
      await mailer.send({ to: row.recipient, subject: message.subject, html: message.html });
      await runTenant((tx) => finalizeNotification(tx, { tenantId, id: row.id, status: 'sent' }));
      counts.sent += 1;
    } catch {
      await runTenant((tx) => finalizeNotification(tx, { tenantId, id: row.id, status: 'failed' }));
      counts.failed += 1;
    }
  }

  return counts;
}

/** One tick's totals across every active tenant. */
export interface TickCounts extends DispatchCounts {
  tenants: number;
}

/** Dispatch every active tenant's queue, each inside its own tenant scope. */
export async function runDispatchTick(deps: {
  listActiveTenants(): Promise<Array<{ id: string }>>;
  runTenantFor(tenantId: string): TenantRunner;
  resolveMailer(tenantId: string): Promise<Mailer | null>;
  render: NotificationRenderer;
  limit?: number;
}): Promise<TickCounts> {
  const tenants = await deps.listActiveTenants();
  const totals: TickCounts = { tenants: tenants.length, sent: 0, failed: 0, skipped: 0 };

  for (const tenant of tenants) {
    const mailer = await deps.resolveMailer(tenant.id);
    const counts = await dispatchTenantNotifications({
      tenantId: tenant.id,
      runTenant: deps.runTenantFor(tenant.id),
      mailer,
      render: deps.render,
      ...(deps.limit !== undefined ? { limit: deps.limit } : {}),
    });
    totals.sent += counts.sent;
    totals.failed += counts.failed;
    totals.skipped += counts.skipped;
  }

  return totals;
}
