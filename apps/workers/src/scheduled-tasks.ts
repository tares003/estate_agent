import { isWorkerDue, type WorkerDefinition } from '@estate/scheduler';

// EPIC-U FR-U-7 / FR-U-8 / FR-U-9 — the per-tenant scheduling wrapper.
//
// Every TENANT-LOOP worker (the saved-search digests + instant alerts, which already fan
// out tenant by tenant) runs through `runScheduledWorker`, which — inside the tenant's own
// RLS scope — decides whether to run, runs it, and records the run:
//
//   1. FR-U-8 pause: a paused worker does not run for that tenant, and a paused worker is
//      not run by "Run now" either ("Paused workers do not run", full stop).
//   2. FR-U-9 tenant-local cadence: a daily/weekly worker is due only at the tenant's own
//      local hour, and only once per tenant-local day. The tick therefore runs HOURLY and
//      each tenant fires on its own clock, instead of every tenant sharing one server-time
//      cron. The once-per-local-day guard is what makes an hourly tick idempotent.
//   3. §H.23 "Run now": a pending `runRequestedAt` forces a run even when the cadence says
//      no, and is CLEARED as it is consumed so it fires exactly once. It is a request
//      rather than a direct invocation because apps/web owns no BullMQ producer.
//   4. FR-U-7 run log: an execution that DID WORK writes a `worker_runs` row (started,
//      finished, outcome, detail) — the console's last-run / outcome / average-runtime
//      columns. `execute` returns its summary line, or null for an idle tick. Idle ticks
//      are not recorded: the instant-alert worker polls every minute, so logging empty
//      ticks would write ~1,400 rows per tenant per day and bury the runs that matter.
//      "Last run" therefore reads as "the last time this worker did something for you",
//      which is the useful answer. A FAILED run and an explicitly requested Run-now are
//      always recorded, idle or not — an operator who presses the button must see what
//      happened.
//
// A worker that throws is recorded as a FAILED run and does NOT rethrow: one tenant's
// failure must never abort the tick for every other tenant (the console surfaces it).
//
// NOTE: the three outbox DISPATCHERS (email / sms / image) are platform-level loops, not
// per-tenant loops — they drain a queue across tenants. Pause + per-tenant run-recording
// for those needs the dispatchers to filter their claim query by tenant, which is a
// separate slice; the console marks them "continuous" and does not offer the controls.

/** How a run ended, as stored on `worker_runs.outcome`. */
export type WorkerRunOutcome = 'success' | 'failed';

/** Why a tick did not execute the worker for a tenant (for the caller's logging). */
export type SkipReason = 'paused' | 'not_due';

/** The result of one worker's tick for one tenant. */
export type ScheduledResult =
  | {
      status: 'ran';
      outcome: WorkerRunOutcome;
      detail: string | null;
      runtimeMs: number;
      recorded: boolean;
    }
  | { status: 'skipped'; reason: SkipReason };

/**
 * The work itself. Returns a one-line summary to record, or `null` when the tick was
 * IDLE (nothing to do for this tenant) — see the module header on why idle ticks are
 * not written to the run log.
 */
export type ScheduledExecute = () => Promise<string | null>;

/** The `worker_schedules` row: the tenant's pause flag + pending Run-now request. */
export interface WorkerScheduleRow {
  paused: boolean;
  runRequestedAt: Date | null;
}

/**
 * The structural client the scheduler needs (a tenant-scoped Prisma tx satisfies it).
 * Kept structural so the whole module is DB-free and unit-testable with a fake.
 */
export interface ScheduledTasksClient {
  workerSchedule: {
    findUnique(args: { where: Record<string, unknown> }): Promise<WorkerScheduleRow | null>;
    update(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }): Promise<unknown>;
  };
  workerRun: {
    findFirst(args: {
      where?: Record<string, unknown>;
      orderBy?: Record<string, unknown>;
    }): Promise<{ startedAt: Date } | null>;
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
}

/** Run `fn` inside one tenant's RLS scope. */
export type ScheduledTenantRunner = <T>(fn: (tx: ScheduledTasksClient) => Promise<T>) => Promise<T>;

/** The tenant's schedule state for a worker; an absent row means "never configured". */
export async function readScheduleState(
  tx: ScheduledTasksClient,
  tenantId: string,
  workerId: string,
): Promise<WorkerScheduleRow> {
  const row = await tx.workerSchedule.findUnique({
    where: { tenantId_workerId: { tenantId, workerId } },
  });
  return row ?? { paused: false, runRequestedAt: null };
}

/** When this worker last ran FOR THIS TENANT (the FR-U-9 once-per-local-day cursor). */
export async function readLastRunAt(
  tx: ScheduledTasksClient,
  workerId: string,
): Promise<Date | null> {
  const row = await tx.workerRun.findFirst({
    where: { workerId },
    orderBy: { startedAt: 'desc' },
  });
  return row?.startedAt ?? null;
}

/**
 * Decide → execute → record, for ONE worker and ONE tenant. See the module header.
 *
 * `execute` returns an optional detail line (a counts summary) that the console shows
 * next to the outcome. Everything happens inside `runTenant`, so the run row is written
 * under the tenant's RLS scope and can never be attributed to the wrong tenant.
 */
export async function runScheduledWorker(opts: {
  tenantId: string;
  timeZone: string;
  worker: WorkerDefinition;
  now: Date;
  runTenant: ScheduledTenantRunner;
  execute: ScheduledExecute;
}): Promise<ScheduledResult> {
  const { tenantId, timeZone, worker, now, runTenant, execute } = opts;

  const decision = await runTenant(async (tx) => {
    const schedule = await readScheduleState(tx, tenantId, worker.id);
    // FR-U-8 — a paused worker does not run, not even on an explicit Run-now.
    if (schedule.paused) return { run: false as const, reason: 'paused' as const };

    const requested = schedule.runRequestedAt !== null;
    if (!requested) {
      const lastRunAt = await readLastRunAt(tx, worker.id);
      if (!isWorkerDue(worker, { now, timeZone, lastRunAt })) {
        return { run: false as const, reason: 'not_due' as const };
      }
    }
    return { run: true as const, requested };
  });

  if (!decision.run) return { status: 'skipped', reason: decision.reason };

  const startedAt = new Date();
  let outcome: WorkerRunOutcome = 'success';
  let detail: string | null = null;
  try {
    detail = await execute();
  } catch (error) {
    // One tenant's failure must not abort the tick for the rest — record and carry on.
    outcome = 'failed';
    detail = error instanceof Error ? error.message : String(error);
  }
  const finishedAt = new Date();

  // Record the run unless it was an idle success on a routine INTERVAL tick (module
  // header). A daily/weekly run is always recorded even when it had nothing to send:
  // its run row IS the once-per-tenant-local-day cursor that isWorkerDue reads, so
  // suppressing it would leave the worker eligible to fire again in the same local day.
  const idle = outcome === 'success' && detail === null;
  const recorded = !(idle && worker.cadence === 'interval' && !decision.requested);

  await runTenant(async (tx) => {
    if (recorded) {
      await tx.workerRun.create({
        data: {
          tenantId,
          workerId: worker.id,
          startedAt,
          finishedAt,
          outcome,
          detail: detail ?? 'nothing to do',
        },
      });
    }
    // Consume the Run-now request so it fires exactly once (§H.23).
    if (decision.requested) {
      await tx.workerSchedule.update({
        where: { tenantId_workerId: { tenantId, workerId: worker.id } },
        data: { runRequestedAt: null },
      });
    }
  });

  return {
    status: 'ran',
    outcome,
    detail,
    runtimeMs: finishedAt.getTime() - startedAt.getTime(),
    recorded,
  };
}
