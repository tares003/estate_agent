import { WORKER_CATALOGUE, type WorkerDefinition } from './catalogue.js';
import { nextRunAt } from './cadence.js';

// EPIC-U FR-U-7 — the scheduled-tasks console row (master spec §H.23): "a table of every
// scheduled job — name, cron expression, last run timestamp, last run outcome, average
// runtime, next run", plus FR-U-8's pause state.
//
// Pure: the caller supplies the tenant's run rows + pause flags (read under RLS) and this
// folds them into one row per DECLARED worker. Deriving the rows from the CATALOGUE (not
// from the run log) is what makes FR-U-10 auto-discovery work — a newly declared worker
// shows up immediately, with "never run" rather than being invisible.

/** How a worker run ended. */
export type RunOutcome = 'success' | 'failed';

/** One recorded run of one worker for one tenant (a row of the run log). */
export interface WorkerRunRecord {
  workerId: string;
  startedAt: Date;
  finishedAt: Date;
  outcome: RunOutcome;
  /** Optional detail: the failure message, or a counts summary on success. */
  detail?: string | null;
}

/** Per-worker pause state for a tenant (FR-U-8). */
export interface WorkerPauseRecord {
  workerId: string;
  paused: boolean;
}

/** One rendered row of the console table. */
export interface WorkerStatus {
  worker: WorkerDefinition;
  /** When it last ran for this tenant; null when it never has. */
  lastRunAt: Date | null;
  /** How the last run ended; null when it never ran. */
  lastOutcome: RunOutcome | null;
  /** The last run's detail line (failure message / counts), when there is one. */
  lastDetail: string | null;
  /** Mean runtime in MILLISECONDS across the recorded runs; null when it never ran. */
  averageRuntimeMs: number | null;
  /** How many runs the average is over (so the console can say "over N runs"). */
  runCount: number;
  /** The next scheduled run; null for interval workers (they show their interval). */
  nextRunAt: Date | null;
  /** FR-U-8 — a paused worker does not run and the console says so. */
  paused: boolean;
}

/** The freshest run per worker, and the mean runtime across all of them. */
function foldRuns(runs: readonly WorkerRunRecord[]): {
  last: WorkerRunRecord | null;
  averageMs: number | null;
  count: number;
} {
  if (runs.length === 0) return { last: null, averageMs: null, count: 0 };

  let last = runs[0]!;
  let totalMs = 0;
  for (const run of runs) {
    if (run.startedAt.getTime() > last.startedAt.getTime()) last = run;
    totalMs += Math.max(0, run.finishedAt.getTime() - run.startedAt.getTime());
  }
  return { last, averageMs: Math.round(totalMs / runs.length), count: runs.length };
}

/**
 * Fold a tenant's run log + pause flags into one console row per DECLARED worker
 * (FR-U-7 / FR-U-8 / FR-U-10). Runs whose `workerId` is not in the catalogue are ignored
 * — a retired worker's history must not conjure a phantom row.
 */
export function summariseWorkers(input: {
  runs: readonly WorkerRunRecord[];
  pauses: readonly WorkerPauseRecord[];
  now: Date;
  timeZone: string;
  catalogue?: readonly WorkerDefinition[];
}): WorkerStatus[] {
  const catalogue = input.catalogue ?? WORKER_CATALOGUE;
  const pausedIds = new Set(
    input.pauses.filter((pause) => pause.paused).map((pause) => pause.workerId),
  );

  return catalogue.map((worker) => {
    const runs = input.runs.filter((run) => run.workerId === worker.id);
    const { last, averageMs, count } = foldRuns(runs);
    return {
      worker,
      lastRunAt: last?.startedAt ?? null,
      lastOutcome: last?.outcome ?? null,
      lastDetail: last?.detail ?? null,
      averageRuntimeMs: averageMs,
      runCount: count,
      nextRunAt: nextRunAt(worker, input.now, input.timeZone),
      paused: pausedIds.has(worker.id),
    };
  });
}

/** Format a runtime for the console ("820ms", "1.4s", "2m 05s"); null → "—". */
export function formatRuntime(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}
