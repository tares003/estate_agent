import {
  summariseWorkers,
  type WorkerPauseRecord,
  type WorkerRunRecord,
  type WorkerStatus,
} from '@estate/scheduler';

// EPIC-U FR-U-7 / FR-U-8 / FR-U-10 — the read model behind /admin/scheduled-tasks (master
// spec §H.23: "a table of every scheduled job — name, cron expression, last run timestamp,
// last run outcome, average runtime, next run", each pause-able and run-able on demand).
//
// The rows are derived from the CATALOGUE, not from the run log, so a newly declared worker
// appears immediately with "never run" instead of being invisible until its first tick
// (FR-U-10). The fold itself lives in @estate/scheduler — the same package the worker
// process schedules from — so what the console SAYS a worker does and what the worker
// actually does cannot drift apart.
//
// Structural reader (not PrismaClient) so this is unit-testable without a database; the
// caller passes a tenant-scoped tx, which is what confines both queries to the tenant's own
// rows under RLS.

/** How many runs back the average-runtime and last-run columns look. */
const RUN_HISTORY_LIMIT = 50;

/** The tenant-scoped reads this model needs. */
export interface ScheduledTasksReader {
  workerRun: {
    findMany(args: {
      select?: Record<string, unknown>;
      orderBy?: Record<string, unknown>;
      take?: number;
    }): Promise<WorkerRunRecord[]>;
  };
  workerSchedule: {
    findMany(args: {
      select?: Record<string, unknown>;
    }): Promise<(WorkerPauseRecord & { runRequestedAt: Date | null })[]>;
  };
}

/** A console row: the worker's status plus whether a Run-now is still pending. */
export interface ScheduledTaskRow extends WorkerStatus {
  /** True between pressing "Run now" and the worker picking the request up. */
  runRequested: boolean;
}

/**
 * The console table for one tenant, at `now`, on the tenant's own clock.
 *
 * `timeZone` drives the "next run" column: a daily digest configured for 07:00 fires at
 * 07:00 in the TENANT's zone (FR-U-9), so the next-run instant differs per tenant and
 * shifts across DST. Passing the tenant's zone here is what keeps the console honest
 * about when the worker will actually fire.
 */
export async function loadScheduledTasks(
  tx: ScheduledTasksReader,
  input: { now: Date; timeZone: string },
): Promise<ScheduledTaskRow[]> {
  const [runs, schedules] = await Promise.all([
    tx.workerRun.findMany({
      select: {
        workerId: true,
        startedAt: true,
        finishedAt: true,
        outcome: true,
        detail: true,
      },
      orderBy: { startedAt: 'desc' },
      take: RUN_HISTORY_LIMIT,
    }),
    tx.workerSchedule.findMany({
      select: { workerId: true, paused: true, runRequestedAt: true },
    }),
  ]);

  const requested = new Set(
    schedules.filter((row) => row.runRequestedAt !== null).map((row) => row.workerId),
  );

  return summariseWorkers({
    runs,
    pauses: schedules,
    now: input.now,
    timeZone: input.timeZone,
  }).map((status) => ({ ...status, runRequested: requested.has(status.worker.id) }));
}
