/**
 * @estate/scheduler — EPIC-U worker catalogue + cadence maths.
 *
 * The single-file worker declaration the scheduled-tasks console auto-discovers
 * (FR-U-10), the tenant-local due/next-run computation for daily + weekly cadences
 * (FR-U-9), and the run-log fold the console table renders (FR-U-7 / FR-U-8).
 *
 * Pure and DB-free: `apps/workers` uses it to decide what to run, `apps/web` uses the
 * SAME declarations to render the console, so the two can never drift.
 */

export {
  WORKER_CATALOGUE,
  findWorker,
  workerIds,
  type WorkerCadence,
  type WorkerDefinition,
} from './catalogue.js';

export {
  isWorkerDue,
  nextRunAt,
  tenantLocalParts,
  type DueInput,
  type TenantLocalParts,
} from './cadence.js';

export {
  formatRuntime,
  summariseWorkers,
  type RunOutcome,
  type WorkerPauseRecord,
  type WorkerRunRecord,
  type WorkerStatus,
} from './run-summary.js';
