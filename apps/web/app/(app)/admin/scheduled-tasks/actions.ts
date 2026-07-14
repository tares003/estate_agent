'use server';

import { audit, withTenant, type AuditWriter } from '@estate/db';
import { findWorker } from '@estate/scheduler';
import type { FormErrorItem } from '@estate/ui';

import { getDb } from '../../lib/db.js';
import { getStaffActor, requireStaffPermission } from '../../lib/staff-session.js';
import { getCurrentTenantId, getRequestIp, getRequestUserAgent } from '../../lib/tenant.js';

// EPIC-U FR-U-8 + master spec §H.23 — the audited, RBAC-gated controls on the
// scheduled-tasks console: pause / resume a worker for this tenant, and request an
// out-of-cadence run ("Run now").
//
// Both gate fail-closed on `setting.manage` BEFORE any read or write, resolve the worker
// against the CATALOGUE (an unknown id is rejected — the console can only drive workers
// that actually exist, and a stale form cannot mint a schedule row for a retired worker),
// then upsert the tenant's `worker_schedules` row and write the audit row (G4) inside one
// tenant transaction.
//
// "Run now" stamps `run_requested_at` rather than invoking anything: apps/web owns no
// BullMQ producer, so the request is picked up — and cleared — by the worker's own next
// tick (see apps/workers/src/scheduled-tasks.ts). The console therefore shows "run
// queued" until the worker takes it, which is the honest state.
//
// These are authenticated admin actions, so they carry no Turnstile (G8 covers public,
// unauthenticated forms). This module carries 'use server', so it exports only async
// functions — the action-state interface is a type and is erased at build.

/** The structural tenant-scoped client these actions read + write through. */
interface ScheduledTasksClient extends AuditWriter {
  workerSchedule: {
    findUnique(args: {
      where: Record<string, unknown>;
      select?: Record<string, unknown>;
    }): Promise<{ paused: boolean } | null>;
    upsert(args: {
      where: Record<string, unknown>;
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }): Promise<unknown>;
  };
}

/** The result of a console control, consumed by `useActionState`. */
export interface ScheduledTaskActionState {
  ok: boolean;
  errors?: FormErrorItem[];
}

function deny(message: string): ScheduledTaskActionState {
  return { ok: false, errors: [{ message }] };
}

/** The submitted worker id, if it names a worker that actually exists. */
function readWorkerId(formData: FormData): string | null {
  const raw = formData.get('workerId');
  if (typeof raw !== 'string') return null;
  return findWorker(raw) ? raw : null;
}

/** FR-U-8 — pause or resume a worker for this tenant, without a redeploy. */
export async function setWorkerPaused(
  _prevState: ScheduledTaskActionState,
  formData: FormData,
): Promise<ScheduledTaskActionState> {
  try {
    await requireStaffPermission('setting.manage');
  } catch {
    return deny('You do not have permission to change scheduled tasks.');
  }

  const workerId = readWorkerId(formData);
  if (workerId === null) return deny('That scheduled task no longer exists.');
  const paused = formData.get('paused') === 'true';

  const tenantId = await getCurrentTenantId();
  const actor = await getStaffActor();
  const ip = await getRequestIp();
  const userAgent = await getRequestUserAgent();

  let result: ScheduledTaskActionState = deny('The scheduled task could not be updated.');
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as ScheduledTasksClient;
    const existing = await tx.workerSchedule.findUnique({
      where: { tenantId_workerId: { tenantId, workerId } },
      select: { paused: true },
    });
    await tx.workerSchedule.upsert({
      where: { tenantId_workerId: { tenantId, workerId } },
      create: { tenantId, workerId, paused },
      update: { paused },
    });
    await audit(tx, {
      tenantId,
      actor,
      action: paused ? 'worker_schedule.paused' : 'worker_schedule.resumed',
      entity: 'worker_schedule',
      entityId: workerId,
      diff: { paused: { from: existing?.paused ?? false, to: paused } },
      ip,
      userAgent,
    });
    result = { ok: true };
  });
  return result;
}

/**
 * §H.23 "Run now" — request an out-of-cadence run for this tenant. The worker's next
 * tick picks the request up and clears it; a PAUSED worker still will not run (the
 * worker enforces that), so the console does not offer the control while paused.
 */
export async function requestWorkerRun(
  _prevState: ScheduledTaskActionState,
  formData: FormData,
): Promise<ScheduledTaskActionState> {
  try {
    await requireStaffPermission('setting.manage');
  } catch {
    return deny('You do not have permission to run scheduled tasks.');
  }

  const workerId = readWorkerId(formData);
  if (workerId === null) return deny('That scheduled task no longer exists.');

  const tenantId = await getCurrentTenantId();
  const actor = await getStaffActor();
  const ip = await getRequestIp();
  const userAgent = await getRequestUserAgent();
  const requestedAt = new Date();

  let result: ScheduledTaskActionState = deny('The run could not be requested.');
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as ScheduledTasksClient;
    const existing = await tx.workerSchedule.findUnique({
      where: { tenantId_workerId: { tenantId, workerId } },
      select: { paused: true },
    });
    // A paused worker will not run, so queueing a request against it would strand the
    // request and mislead the operator. Resume it first.
    if (existing?.paused === true) {
      result = deny('This task is paused. Resume it before running it.');
      return;
    }
    await tx.workerSchedule.upsert({
      where: { tenantId_workerId: { tenantId, workerId } },
      create: { tenantId, workerId, paused: false, runRequestedAt: requestedAt },
      update: { runRequestedAt: requestedAt },
    });
    await audit(tx, {
      tenantId,
      actor,
      action: 'worker_schedule.run_requested',
      entity: 'worker_schedule',
      entityId: workerId,
      diff: { runRequestedAt: { from: null, to: requestedAt.toISOString() } },
      ip,
      userAgent,
    });
    result = { ok: true };
  });
  return result;
}
