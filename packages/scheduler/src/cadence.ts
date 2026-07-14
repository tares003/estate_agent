import type { WorkerDefinition } from './catalogue.js';

// EPIC-U FR-U-9 — "A worker's per-tenant work shall be scheduled in the tenant's local
// time zone where the cadence is daily or weekly" (user story: the digest should "arrive
// at 7am MY time", not at 07:00 server time).
//
// The dispatch shape: the daily/weekly workers tick HOURLY, and each tick asks, per
// tenant, "is it the target hour in THIS tenant's zone, and have we not already run
// today there?". That keeps one cron for all tenants while still landing on each
// tenant's local hour, and it is inherently DST-correct — the tenant's local clock is
// read from the instant via `Intl`, so a zone that springs forward simply has no 01:00
// that day and the run lands on the next matching hour.
//
// The "already ran today (locally)" guard is what makes an hourly tick idempotent: a
// worker fires at most ONCE per tenant-local day (or week), no matter how many ticks
// see the target hour, and a replayed tick re-sends nothing.

/** ISO weekday numbering: 1 = Monday … 7 = Sunday. */
const WEEKDAY_INDEX: Readonly<Record<string, number>> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

/** An instant, as the tenant's own wall clock reads it. */
export interface TenantLocalParts {
  /** Hour 0-23 in the tenant's zone. */
  hour: number;
  /** ISO weekday in the tenant's zone (1 = Monday … 7 = Sunday). */
  weekday: number;
  /** `YYYY-MM-DD` in the tenant's zone — the "already ran today" key. */
  dateKey: string;
}

/**
 * Read an instant on the tenant's wall clock. `hourCycle: 'h23'` pins midnight to `00`
 * (some runtimes render it `24` under `hour12: false`), so the hour compares cleanly.
 * An unknown/invalid zone would throw from `Intl`; {@link isWorkerDue} treats that as
 * "not due" rather than crashing the whole tick for every other tenant.
 */
export function tenantLocalParts(instant: Date, timeZone: string): TenantLocalParts {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);

  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';

  return {
    hour: Number(get('hour')),
    weekday: WEEKDAY_INDEX[get('weekday')] ?? 0,
    dateKey: `${get('year')}-${get('month')}-${get('day')}`,
  };
}

/** The inputs a per-tenant due-check needs. */
export interface DueInput {
  /** The instant the tick is running at. */
  now: Date;
  /** The tenant's IANA zone (e.g. `Europe/London`). */
  timeZone: string;
  /** When this worker last ran FOR THIS TENANT; null when it never has. */
  lastRunAt: Date | null;
}

/**
 * Whether a worker should run for this tenant on this tick (FR-U-9).
 *
 * - `interval` workers are always due — they tick on their own BullMQ interval and do
 *   not consult the tenant clock at all.
 * - `daily` is due when the tenant-local hour matches and the worker has not already
 *   run on this tenant-local DAY.
 * - `weekly` additionally requires the tenant-local weekday to match.
 *
 * An unparseable time zone yields "not due" rather than throwing: one tenant with a
 * corrupt zone must never break the tick for every other tenant.
 */
export function isWorkerDue(worker: WorkerDefinition, input: DueInput): boolean {
  if (worker.cadence === 'interval') return true;

  let local: TenantLocalParts;
  try {
    local = tenantLocalParts(input.now, input.timeZone);
  } catch {
    return false;
  }

  if (worker.localHour !== undefined && local.hour !== worker.localHour) return false;
  if (worker.cadence === 'weekly' && local.weekday !== worker.localWeekday) return false;

  // Already ran on this tenant-local day? Then this is a later tick of the same hour
  // (or a replay) — not due again.
  if (input.lastRunAt !== null) {
    let lastLocal: TenantLocalParts;
    try {
      lastLocal = tenantLocalParts(input.lastRunAt, input.timeZone);
    } catch {
      return false;
    }
    if (lastLocal.dateKey === local.dateKey) return false;
  }

  return true;
}

/** How far ahead {@link nextRunAt} will search before giving up (8 days of hours). */
const SEARCH_HOURS = 8 * 24;
const HOUR_MS = 60 * 60 * 1000;

/**
 * The next instant this worker will run for the tenant — the console's "next run"
 * column (master spec §H.23). Returns null for an `interval` worker (it has no wall-clock
 * schedule; the console shows its interval instead) and for an unresolvable zone.
 *
 * Implemented by scanning forward hour by hour from the next whole hour and asking the
 * tenant's own clock, so DST transitions need no special handling: an hour that does not
 * exist locally is simply never matched, and a repeated hour matches once.
 */
export function nextRunAt(worker: WorkerDefinition, now: Date, timeZone: string): Date | null {
  if (worker.cadence === 'interval' || worker.localHour === undefined) return null;

  // Start at the top of the NEXT hour: the current hour either already fired or is
  // mid-flight, so the next run is never inside it.
  const start = new Date(Math.floor(now.getTime() / HOUR_MS) * HOUR_MS + HOUR_MS);

  for (let step = 0; step < SEARCH_HOURS; step += 1) {
    const candidate = new Date(start.getTime() + step * HOUR_MS);
    let local: TenantLocalParts;
    try {
      local = tenantLocalParts(candidate, timeZone);
    } catch {
      return null;
    }
    if (local.hour !== worker.localHour) continue;
    if (worker.cadence === 'weekly' && local.weekday !== worker.localWeekday) continue;
    return candidate;
  }
  return null;
}
