import { describe, expect, it } from 'vitest';

import type { WorkerDefinition } from './catalogue.js';
import { isWorkerDue, nextRunAt, tenantLocalParts } from './cadence.js';

// EPIC-U FR-U-9 — daily/weekly work fires at the TENANT's local hour, not server time.
// The dispatch shape is an hourly tick that asks each tenant "is it your hour yet, and
// have you already run today?", so these tests pin: the tenant clock read, the hour
// match, the once-per-local-day guard (what makes an hourly tick idempotent), the
// weekday match, DST correctness, and fail-soft on a corrupt zone.

const DAILY: WorkerDefinition = {
  id: 'saved_search_daily',
  name: 'Daily',
  description: 'd',
  cadence: 'daily',
  schedule: '07:00 tenant-local',
  localHour: 7,
};

const WEEKLY: WorkerDefinition = {
  id: 'saved_search_weekly',
  name: 'Weekly',
  description: 'w',
  cadence: 'weekly',
  schedule: 'Mon 08:00 tenant-local',
  localHour: 8,
  localWeekday: 1,
};

const INTERVAL: WorkerDefinition = {
  id: 'email_send',
  name: 'Email',
  description: 'e',
  cadence: 'interval',
  schedule: 'every 15 seconds',
};

describe('tenantLocalParts', () => {
  it('reads an instant on the tenant wall clock, not the server clock', () => {
    // 2026-07-01T06:00Z is 07:00 in London (BST, +1) but 08:00 in Paris (CEST, +2).
    const instant = new Date('2026-07-01T06:00:00Z');
    expect(tenantLocalParts(instant, 'Europe/London').hour).toBe(7);
    expect(tenantLocalParts(instant, 'Europe/Paris').hour).toBe(8);
    expect(tenantLocalParts(instant, 'UTC').hour).toBe(6);
  });

  it('numbers the weekday ISO-style (Monday = 1) and keys the local date', () => {
    const monday = new Date('2026-07-06T09:00:00Z'); // a Monday
    const parts = tenantLocalParts(monday, 'Europe/London');
    expect(parts.weekday).toBe(1);
    expect(parts.dateKey).toBe('2026-07-06');
  });

  it('renders local midnight as hour 0, not 24', () => {
    // 2026-01-15T00:00Z is 00:00 in London (GMT in January).
    expect(tenantLocalParts(new Date('2026-01-15T00:00:00Z'), 'Europe/London').hour).toBe(0);
  });

  it('rolls the local DATE across a zone boundary', () => {
    // 23:30Z on the 1st is already 08:30 on the 2nd in Tokyo (+9).
    const parts = tenantLocalParts(new Date('2026-07-01T23:30:00Z'), 'Asia/Tokyo');
    expect(parts.dateKey).toBe('2026-07-02');
    expect(parts.hour).toBe(8);
  });
});

describe('isWorkerDue — daily (FR-U-9)', () => {
  it('is due at the tenant local hour, NOT at the same server hour', () => {
    // 06:00Z = 07:00 London → due there; but only 06:00 in UTC → not due for a UTC tenant.
    const now = new Date('2026-07-01T06:00:00Z');
    expect(isWorkerDue(DAILY, { now, timeZone: 'Europe/London', lastRunAt: null })).toBe(true);
    expect(isWorkerDue(DAILY, { now, timeZone: 'UTC', lastRunAt: null })).toBe(false);
  });

  it('fires for a UTC tenant an hour later — the same tick serves both zones', () => {
    const now = new Date('2026-07-01T07:00:00Z'); // 07:00 UTC, 08:00 London
    expect(isWorkerDue(DAILY, { now, timeZone: 'UTC', lastRunAt: null })).toBe(true);
    expect(isWorkerDue(DAILY, { now, timeZone: 'Europe/London', lastRunAt: null })).toBe(false);
  });

  it('does NOT fire twice on the same tenant-local day (an hourly tick is idempotent)', () => {
    const now = new Date('2026-07-01T06:00:00Z'); // 07:00 London
    const ranEarlierToday = new Date('2026-07-01T06:00:00Z');
    expect(isWorkerDue(DAILY, { now, timeZone: 'Europe/London', lastRunAt: ranEarlierToday })).toBe(
      false,
    );
  });

  it('fires again the NEXT tenant-local day', () => {
    const now = new Date('2026-07-02T06:00:00Z'); // 07:00 London, next day
    const ranYesterday = new Date('2026-07-01T06:00:00Z');
    expect(isWorkerDue(DAILY, { now, timeZone: 'Europe/London', lastRunAt: ranYesterday })).toBe(
      true,
    );
  });

  it('is never due outside the target local hour', () => {
    const now = new Date('2026-07-01T10:00:00Z'); // 11:00 London
    expect(isWorkerDue(DAILY, { now, timeZone: 'Europe/London', lastRunAt: null })).toBe(false);
  });
});

describe('isWorkerDue — weekly (FR-U-9)', () => {
  it('is due only on the target tenant-local weekday AND hour', () => {
    const mondayLocal8 = new Date('2026-07-06T07:00:00Z'); // Mon 08:00 London
    expect(
      isWorkerDue(WEEKLY, { now: mondayLocal8, timeZone: 'Europe/London', lastRunAt: null }),
    ).toBe(true);

    const tuesdayLocal8 = new Date('2026-07-07T07:00:00Z'); // Tue 08:00 London
    expect(
      isWorkerDue(WEEKLY, { now: tuesdayLocal8, timeZone: 'Europe/London', lastRunAt: null }),
    ).toBe(false);

    const mondayLocal9 = new Date('2026-07-06T08:00:00Z'); // Mon 09:00 London
    expect(
      isWorkerDue(WEEKLY, { now: mondayLocal9, timeZone: 'Europe/London', lastRunAt: null }),
    ).toBe(false);
  });

  it('does not re-fire later the same Monday', () => {
    const now = new Date('2026-07-06T07:00:00Z');
    expect(isWorkerDue(WEEKLY, { now, timeZone: 'Europe/London', lastRunAt: now })).toBe(false);
  });
});

describe('isWorkerDue — interval + fail-soft', () => {
  it('an interval worker is always due (it ticks on its own BullMQ interval)', () => {
    const now = new Date('2026-07-01T03:17:00Z');
    expect(isWorkerDue(INTERVAL, { now, timeZone: 'Europe/London', lastRunAt: now })).toBe(true);
  });

  it('a corrupt tenant time zone yields NOT due — it must not break the tick for others', () => {
    const now = new Date('2026-07-01T06:00:00Z');
    expect(isWorkerDue(DAILY, { now, timeZone: 'Not/AZone', lastRunAt: null })).toBe(false);
  });
});

describe('nextRunAt (the console "next run" column)', () => {
  it('finds the next tenant-local 07:00 for a daily worker', () => {
    const now = new Date('2026-07-01T10:00:00Z'); // 11:00 London, today's run is past
    const next = nextRunAt(DAILY, now, 'Europe/London');
    expect(next).not.toBeNull();
    // Next 07:00 London = 06:00Z on the 2nd (BST).
    expect(next!.toISOString()).toBe('2026-07-02T06:00:00.000Z');
  });

  it('resolves the next Monday 08:00 for a weekly worker', () => {
    const now = new Date('2026-07-01T12:00:00Z'); // a Wednesday
    const next = nextRunAt(WEEKLY, now, 'Europe/London');
    expect(next).not.toBeNull();
    // Next Monday is 2026-07-06; 08:00 London = 07:00Z (BST).
    expect(next!.toISOString()).toBe('2026-07-06T07:00:00.000Z');
    expect(tenantLocalParts(next!, 'Europe/London').weekday).toBe(1);
  });

  it('lands on the tenant local hour across a DST change, not a fixed UTC offset', () => {
    // London leaves BST on 2026-10-25. A daily 07:00-local run is 06:00Z before the
    // change and 07:00Z after it — a fixed UTC cron would drift by an hour.
    const beforeChange = nextRunAt(DAILY, new Date('2026-10-20T12:00:00Z'), 'Europe/London');
    const afterChange = nextRunAt(DAILY, new Date('2026-10-27T12:00:00Z'), 'Europe/London');
    expect(tenantLocalParts(beforeChange!, 'Europe/London').hour).toBe(7);
    expect(tenantLocalParts(afterChange!, 'Europe/London').hour).toBe(7);
    expect(beforeChange!.getUTCHours()).toBe(6); // BST
    expect(afterChange!.getUTCHours()).toBe(7); // GMT
  });

  it('returns null for an interval worker (it has no wall-clock schedule)', () => {
    expect(nextRunAt(INTERVAL, new Date('2026-07-01T00:00:00Z'), 'Europe/London')).toBeNull();
  });

  it('returns null for an unresolvable zone rather than throwing', () => {
    expect(nextRunAt(DAILY, new Date('2026-07-01T00:00:00Z'), 'Not/AZone')).toBeNull();
  });
});
