// EPIC-U FR-U-10 — the SINGLE-FILE worker declaration.
//
// "A new worker can be added by a developer via a single-file declaration; the
// scheduled-tasks console picks it up automatically." This module IS that file: the
// admin console (FR-U-7) renders one row per entry here, and the workers process wires
// its ticks from the same list. Adding a worker means adding one `WorkerDefinition` —
// no console change, no migration, no registry to keep in sync.
//
// Master spec §H.23 lists more built-in jobs than exist today (sitemap_regenerate,
// portal_feed_push, expired_property_archive, ...). Only the workers that are actually
// BUILT are declared here — the console must reflect reality, not aspiration, or its
// "last run / next run" columns would show permanently-never-ran phantom rows.

/** How often a worker runs. Daily/weekly are the tenant-local cadences (FR-U-9). */
export type WorkerCadence = 'interval' | 'daily' | 'weekly';

/** One scheduled worker, as the console renders it and the workers process wires it. */
export interface WorkerDefinition {
  /** Stable machine id — the run-log key. Never renamed (it is persisted). */
  id: string;
  /** Human name for the console table (master spec §H.23). */
  name: string;
  /** What the worker does, for the console's description column. */
  description: string;
  cadence: WorkerCadence;
  /**
   * The schedule, as the console displays it (§H.23 "cron expression"). For an
   * `interval` worker this is the human interval ("every 15s"); for daily/weekly it is
   * the cron the tick fires on — but see FR-U-9: the tenant-local hour, not server time.
   */
  schedule: string;
  /**
   * For daily/weekly workers, the tenant-LOCAL hour (0-23) the work should run at
   * (FR-U-9: "arrive at 7am my time"). Absent for interval workers.
   */
  localHour?: number;
  /** For weekly workers, the ISO weekday (1 = Monday … 7 = Sunday). */
  localWeekday?: number;
  /**
   * Whether the worker runs as a PER-TENANT loop — one decision, one run-log row and one
   * pause flag per tenant. Those are the workers the console can genuinely control
   * (FR-U-8) and report on (FR-U-7).
   *
   * The outbox dispatchers (email / SMS / images) are false: they drain one shared queue
   * across every tenant, so there is no per-tenant run to record and no per-tenant pause
   * to honour. The console lists them — a tenant should still see that they exist and
   * what they do — but marks them continuous and offers no controls, rather than showing
   * a Pause button that would silently do nothing.
   */
  perTenant: boolean;
}

/**
 * Every scheduled worker in the platform. The console auto-discovers from this list
 * (FR-U-10), so a new worker needs only a new entry here.
 */
export const WORKER_CATALOGUE: readonly WorkerDefinition[] = [
  {
    id: 'email_send',
    name: 'Email dispatch',
    description: 'Sends queued emails from the notification outbox.',
    cadence: 'interval',
    schedule: 'every 30 seconds',
    perTenant: false,
  },
  {
    id: 'sms_send',
    name: 'SMS dispatch',
    description: 'Sends queued SMS messages (emergency repairs, 2FA fallback).',
    cadence: 'interval',
    schedule: 'every 30 seconds',
    perTenant: false,
  },
  {
    id: 'image_processing',
    name: 'Image processing',
    description: 'Strips EXIF and builds the thumbnail / large renditions (FR-F-7).',
    cadence: 'interval',
    schedule: 'every 60 seconds',
    perTenant: false,
  },
  {
    id: 'saved_search_instant',
    name: 'Saved-search alerts (instant)',
    description: 'Emails instant-cadence saved searches when a matching property is published.',
    cadence: 'interval',
    schedule: 'every minute',
    perTenant: true,
  },
  {
    id: 'saved_search_daily',
    name: 'Saved-search alerts (daily)',
    description: 'Emails one daily digest of new matches per saved search.',
    cadence: 'daily',
    schedule: '07:00 tenant-local',
    localHour: 7,
    perTenant: true,
  },
  {
    id: 'saved_search_weekly',
    name: 'Saved-search alerts (weekly)',
    description: 'Emails one weekly digest of new matches per saved search.',
    cadence: 'weekly',
    schedule: 'Monday 08:00 tenant-local',
    localHour: 8,
    localWeekday: 1,
    perTenant: true,
  },
];

/** The worker with this id, or undefined when the id is unknown (a stale run row). */
export function findWorker(id: string): WorkerDefinition | undefined {
  return WORKER_CATALOGUE.find((worker) => worker.id === id);
}

/** Every declared worker id — the set the console and the run log agree on. */
export function workerIds(): string[] {
  return WORKER_CATALOGUE.map((worker) => worker.id);
}
