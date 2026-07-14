import type { WorkerDefinition } from '@estate/scheduler';
import { describe, expect, it, vi } from 'vitest';

import {
  runScheduledWorker,
  type ScheduledTasksClient,
  type WorkerScheduleRow,
} from './scheduled-tasks.js';

// EPIC-U FR-U-7 / FR-U-8 / FR-U-9 — the per-tenant scheduling wrapper. These pin the four
// decisions the wrapper owns: pause (a paused worker does not run, even on Run-now),
// tenant-local cadence, Run-now (forces a run and is consumed exactly once), and the run
// log (recorded on real work, on failure and on request; skipped on an idle routine tick).

const TENANT = '11111111-1111-1111-1111-111111111111';

const DAILY: WorkerDefinition = {
  id: 'saved_search_daily',
  name: 'Daily digest',
  description: 'd',
  cadence: 'daily',
  schedule: '07:00 tenant-local',
  localHour: 7,
  perTenant: true,
};

const INSTANT: WorkerDefinition = {
  id: 'saved_search_instant',
  name: 'Instant alerts',
  description: 'i',
  cadence: 'interval',
  schedule: 'every minute',
  perTenant: true,
};

/** In-memory stand-in for the tenant-scoped Prisma tx. */
function fakeDb(over: { schedule?: WorkerScheduleRow | null; lastRunAt?: Date | null } = {}) {
  const created: Record<string, unknown>[] = [];
  const updated: Record<string, unknown>[] = [];
  const client: ScheduledTasksClient = {
    workerSchedule: {
      findUnique: () => Promise.resolve(over.schedule ?? null),
      update: (args) => {
        updated.push(args.data);
        return Promise.resolve({});
      },
    },
    workerRun: {
      findFirst: () => Promise.resolve(over.lastRunAt ? { startedAt: over.lastRunAt } : null),
      create: (args) => {
        created.push(args.data);
        return Promise.resolve({});
      },
    },
  };
  const runTenant = <T>(fn: (tx: ScheduledTasksClient) => Promise<T>): Promise<T> => fn(client);
  return { created, updated, runTenant };
}

/** 06:00Z = 07:00 London — the daily worker's target local hour. */
const DUE_NOW = new Date('2026-07-01T06:00:00Z');
/** 10:00Z = 11:00 London — outside the target hour. */
const IDLE_NOW = new Date('2026-07-01T10:00:00Z');

describe('runScheduledWorker — pause (FR-U-8)', () => {
  it('does not run a paused worker, and records nothing', async () => {
    const db = fakeDb({ schedule: { paused: true, runRequestedAt: null } });
    const execute = vi.fn(() => Promise.resolve('did work'));

    const result = await runScheduledWorker({
      tenantId: TENANT,
      timeZone: 'Europe/London',
      worker: DAILY,
      now: DUE_NOW,
      runTenant: db.runTenant,
      execute,
    });

    expect(result).toEqual({ status: 'skipped', reason: 'paused' });
    expect(execute).not.toHaveBeenCalled();
    expect(db.created).toHaveLength(0);
  });

  it('does not run a paused worker even when a Run-now is pending (paused means paused)', async () => {
    const db = fakeDb({ schedule: { paused: true, runRequestedAt: new Date() } });
    const execute = vi.fn(() => Promise.resolve('did work'));

    const result = await runScheduledWorker({
      tenantId: TENANT,
      timeZone: 'Europe/London',
      worker: DAILY,
      now: IDLE_NOW,
      runTenant: db.runTenant,
      execute,
    });

    expect(result).toEqual({ status: 'skipped', reason: 'paused' });
    expect(execute).not.toHaveBeenCalled();
  });
});

describe('runScheduledWorker — tenant-local cadence (FR-U-9)', () => {
  it('runs at the tenant local hour', async () => {
    const db = fakeDb();
    const execute = vi.fn(() => Promise.resolve('emailed 3'));

    const result = await runScheduledWorker({
      tenantId: TENANT,
      timeZone: 'Europe/London',
      worker: DAILY,
      now: DUE_NOW,
      runTenant: db.runTenant,
      execute,
    });

    expect(result.status).toBe('ran');
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('does NOT run the same tenant an hour later on the server clock', async () => {
    // 06:00Z is 07:00 in London but only 06:00 in UTC — a UTC tenant is not due yet.
    const db = fakeDb();
    const execute = vi.fn(() => Promise.resolve('emailed 3'));

    const result = await runScheduledWorker({
      tenantId: TENANT,
      timeZone: 'UTC',
      worker: DAILY,
      now: DUE_NOW,
      runTenant: db.runTenant,
      execute,
    });

    expect(result).toEqual({ status: 'skipped', reason: 'not_due' });
    expect(execute).not.toHaveBeenCalled();
  });

  it('does not run twice on the same tenant-local day (the hourly tick is idempotent)', async () => {
    const db = fakeDb({ lastRunAt: new Date('2026-07-01T06:00:00Z') });
    const execute = vi.fn(() => Promise.resolve('emailed 3'));

    const result = await runScheduledWorker({
      tenantId: TENANT,
      timeZone: 'Europe/London',
      worker: DAILY,
      now: DUE_NOW,
      runTenant: db.runTenant,
      execute,
    });

    expect(result).toEqual({ status: 'skipped', reason: 'not_due' });
    expect(execute).not.toHaveBeenCalled();
  });
});

describe('runScheduledWorker — Run now (§H.23)', () => {
  it('forces a run OUTSIDE the cadence when a request is pending', async () => {
    const db = fakeDb({ schedule: { paused: false, runRequestedAt: new Date() } });
    const execute = vi.fn(() => Promise.resolve('emailed 1'));

    const result = await runScheduledWorker({
      tenantId: TENANT,
      timeZone: 'Europe/London',
      worker: DAILY,
      now: IDLE_NOW, // 11:00 local — the cadence says no
      runTenant: db.runTenant,
      execute,
    });

    expect(result.status).toBe('ran');
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('CLEARS the request as it consumes it, so it fires exactly once', async () => {
    const db = fakeDb({ schedule: { paused: false, runRequestedAt: new Date() } });

    await runScheduledWorker({
      tenantId: TENANT,
      timeZone: 'Europe/London',
      worker: DAILY,
      now: IDLE_NOW,
      runTenant: db.runTenant,
      execute: () => Promise.resolve('emailed 1'),
    });

    expect(db.updated).toEqual([{ runRequestedAt: null }]);
  });

  it('records an idle requested run, so the operator sees the outcome of their click', async () => {
    const db = fakeDb({ schedule: { paused: false, runRequestedAt: new Date() } });

    const result = await runScheduledWorker({
      tenantId: TENANT,
      timeZone: 'Europe/London',
      worker: DAILY,
      now: IDLE_NOW,
      runTenant: db.runTenant,
      execute: () => Promise.resolve(null), // nothing to do
    });

    expect(result).toMatchObject({ status: 'ran', outcome: 'success', recorded: true });
    expect(db.created).toHaveLength(1);
    expect(db.created[0]).toMatchObject({ outcome: 'success', detail: 'nothing to do' });
  });

  it('does not clear a request it never consumed', async () => {
    const db = fakeDb({ schedule: { paused: false, runRequestedAt: null } });

    await runScheduledWorker({
      tenantId: TENANT,
      timeZone: 'Europe/London',
      worker: DAILY,
      now: DUE_NOW, // ran on cadence, not on request
      runTenant: db.runTenant,
      execute: () => Promise.resolve('emailed 2'),
    });

    expect(db.updated).toHaveLength(0);
  });
});

describe('runScheduledWorker — the run log (FR-U-7)', () => {
  it('records a successful run against the right tenant and worker, with its detail', async () => {
    const db = fakeDb();

    const result = await runScheduledWorker({
      tenantId: TENANT,
      timeZone: 'Europe/London',
      worker: DAILY,
      now: DUE_NOW,
      runTenant: db.runTenant,
      execute: () => Promise.resolve('emailed 3, advanced 4'),
    });

    expect(result).toMatchObject({ status: 'ran', outcome: 'success', recorded: true });
    expect(db.created).toHaveLength(1);
    expect(db.created[0]).toMatchObject({
      tenantId: TENANT,
      workerId: 'saved_search_daily',
      outcome: 'success',
      detail: 'emailed 3, advanced 4',
    });
    expect(db.created[0]!['startedAt']).toBeInstanceOf(Date);
    expect(db.created[0]!['finishedAt']).toBeInstanceOf(Date);
  });

  it('records a FAILURE with its message and does NOT rethrow (one tenant cannot break the tick)', async () => {
    const db = fakeDb();

    const result = await runScheduledWorker({
      tenantId: TENANT,
      timeZone: 'Europe/London',
      worker: DAILY,
      now: DUE_NOW,
      runTenant: db.runTenant,
      execute: () => Promise.reject(new Error('SMTP timeout')),
    });

    expect(result).toMatchObject({ status: 'ran', outcome: 'failed', detail: 'SMTP timeout' });
    expect(db.created[0]).toMatchObject({ outcome: 'failed', detail: 'SMTP timeout' });
  });

  it('does NOT record an idle routine tick (an every-minute worker would bury the real runs)', async () => {
    const db = fakeDb();

    const result = await runScheduledWorker({
      tenantId: TENANT,
      timeZone: 'Europe/London',
      worker: INSTANT, // interval cadence — always due
      now: IDLE_NOW,
      runTenant: db.runTenant,
      execute: () => Promise.resolve(null), // no new matches this minute
    });

    expect(result).toMatchObject({ status: 'ran', recorded: false });
    expect(db.created).toHaveLength(0);
  });

  it('DOES record an idle DAILY run — its run row is the once-per-local-day cursor', async () => {
    // If an empty digest went unrecorded, lastRunAt would stay null and the worker would
    // stay eligible to fire again within the same tenant-local day.
    const db = fakeDb();

    const result = await runScheduledWorker({
      tenantId: TENANT,
      timeZone: 'Europe/London',
      worker: DAILY,
      now: DUE_NOW,
      runTenant: db.runTenant,
      execute: () => Promise.resolve(null), // nobody had new matches today
    });

    expect(result).toMatchObject({ status: 'ran', recorded: true });
    expect(db.created).toHaveLength(1);
    expect(db.created[0]).toMatchObject({ workerId: 'saved_search_daily', outcome: 'success' });
  });

  it('DOES record an interval tick that actually did work', async () => {
    const db = fakeDb();

    const result = await runScheduledWorker({
      tenantId: TENANT,
      timeZone: 'Europe/London',
      worker: INSTANT,
      now: IDLE_NOW,
      runTenant: db.runTenant,
      execute: () => Promise.resolve('emailed 1'),
    });

    expect(result).toMatchObject({ status: 'ran', recorded: true });
    expect(db.created[0]).toMatchObject({ workerId: 'saved_search_instant', detail: 'emailed 1' });
  });
});
