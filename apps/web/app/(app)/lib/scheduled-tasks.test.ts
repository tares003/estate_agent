import { describe, expect, it, vi } from 'vitest';

import { loadScheduledTasks, type ScheduledTasksReader } from './scheduled-tasks.js';

// EPIC-U FR-U-7 / FR-U-8 / FR-U-10 — the /admin/scheduled-tasks read model. Pins that the
// console lists every DECLARED worker (not merely the ones that have run), folds the run
// log per worker, surfaces the pause flag and the pending Run-now, and computes "next run"
// on the TENANT's clock (FR-U-9) rather than the server's.

const NOW = new Date('2026-07-01T12:00:00Z'); // 13:00 London

function reader(over: {
  runs?: Parameters<ScheduledTasksReader['workerRun']['findMany']> extends never
    ? never
    : unknown[];
  schedules?: unknown[];
}): { tx: ScheduledTasksReader; findMany: ReturnType<typeof vi.fn> } {
  const findMany = vi.fn();
  const tx = {
    workerRun: { findMany: (args: unknown) => findMany(args) ?? Promise.resolve([]) },
    workerSchedule: { findMany: () => Promise.resolve(over.schedules ?? []) },
  } as unknown as ScheduledTasksReader;
  findMany.mockResolvedValue(over.runs ?? []);
  return { tx, findMany };
}

describe('loadScheduledTasks', () => {
  it('lists every declared worker, including ones that have never run (FR-U-10)', async () => {
    const { tx } = reader({});

    const rows = await loadScheduledTasks(tx, { now: NOW, timeZone: 'Europe/London' });

    expect(rows.length).toBeGreaterThanOrEqual(6);
    expect(rows.map((row) => row.worker.id)).toContain('saved_search_daily');
    const daily = rows.find((row) => row.worker.id === 'saved_search_daily')!;
    expect(daily.lastRunAt).toBeNull();
    expect(daily.runCount).toBe(0);
    expect(daily.paused).toBe(false);
    expect(daily.runRequested).toBe(false);
  });

  it('folds the run log onto the right worker, newest run first', async () => {
    const { tx } = reader({
      runs: [
        {
          workerId: 'saved_search_daily',
          startedAt: new Date('2026-07-01T06:00:00Z'),
          finishedAt: new Date('2026-07-01T06:00:02Z'),
          outcome: 'success',
          detail: 'emailed 3, advanced 4',
        },
        {
          workerId: 'saved_search_daily',
          startedAt: new Date('2026-06-30T06:00:00Z'),
          finishedAt: new Date('2026-06-30T06:00:04Z'),
          outcome: 'failed',
          detail: 'SMTP timeout',
        },
      ],
    });

    const rows = await loadScheduledTasks(tx, { now: NOW, timeZone: 'Europe/London' });
    const daily = rows.find((row) => row.worker.id === 'saved_search_daily')!;

    expect(daily.lastOutcome).toBe('success');
    expect(daily.lastDetail).toBe('emailed 3, advanced 4');
    expect(daily.averageRuntimeMs).toBe(3000); // (2000 + 4000) / 2
    expect(daily.runCount).toBe(2);
    // Nothing bled onto a different worker.
    expect(rows.find((row) => row.worker.id === 'email_send')!.runCount).toBe(0);
  });

  it('surfaces the pause flag and a pending Run-now request (FR-U-8 / §H.23)', async () => {
    const { tx } = reader({
      schedules: [
        { workerId: 'saved_search_daily', paused: true, runRequestedAt: null },
        {
          workerId: 'saved_search_weekly',
          paused: false,
          runRequestedAt: new Date('2026-07-01T11:59:00Z'),
        },
      ],
    });

    const rows = await loadScheduledTasks(tx, { now: NOW, timeZone: 'Europe/London' });
    const daily = rows.find((row) => row.worker.id === 'saved_search_daily')!;
    const weekly = rows.find((row) => row.worker.id === 'saved_search_weekly')!;

    expect(daily.paused).toBe(true);
    expect(daily.runRequested).toBe(false);
    expect(weekly.paused).toBe(false);
    expect(weekly.runRequested).toBe(true);
  });

  it('computes "next run" on the TENANT clock, not the server clock (FR-U-9)', async () => {
    const { tx: londonTx } = reader({});
    const { tx: utcTx } = reader({});

    const london = await loadScheduledTasks(londonTx, { now: NOW, timeZone: 'Europe/London' });
    const utc = await loadScheduledTasks(utcTx, { now: NOW, timeZone: 'UTC' });

    const id = 'saved_search_daily'; // 07:00 tenant-local
    const nextLondon = london.find((row) => row.worker.id === id)!.nextRunAt!;
    const nextUtc = utc.find((row) => row.worker.id === id)!.nextRunAt!;

    // Both are "07:00 local", but London is on BST — so it fires an hour earlier in UTC.
    expect(nextLondon.toISOString()).toBe('2026-07-02T06:00:00.000Z');
    expect(nextUtc.toISOString()).toBe('2026-07-02T07:00:00.000Z');
  });

  it('bounds the run history it reads (the log grows without limit)', async () => {
    const { tx, findMany } = reader({});

    await loadScheduledTasks(tx, { now: NOW, timeZone: 'Europe/London' });

    const args = findMany.mock.calls[0]![0] as { take?: number; orderBy?: unknown };
    expect(args.take).toBeGreaterThan(0);
    expect(args.orderBy).toEqual({ startedAt: 'desc' });
  });
});
