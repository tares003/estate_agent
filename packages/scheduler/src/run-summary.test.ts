import { describe, expect, it } from 'vitest';

import type { WorkerDefinition } from './catalogue.js';
import { formatRuntime, summariseWorkers, type WorkerRunRecord } from './run-summary.js';

// EPIC-U FR-U-7 / FR-U-8 / FR-U-10 — the console table (master spec §H.23): one row per
// DECLARED worker with last run, outcome, average runtime, next run and pause state.

const DAILY: WorkerDefinition = {
  id: 'daily_job',
  name: 'Daily job',
  description: 'd',
  cadence: 'daily',
  schedule: '07:00 tenant-local',
  localHour: 7,
};
const INTERVAL: WorkerDefinition = {
  id: 'interval_job',
  name: 'Interval job',
  description: 'i',
  cadence: 'interval',
  schedule: 'every 15 seconds',
};
const CATALOGUE = [DAILY, INTERVAL];

const NOW = new Date('2026-07-01T12:00:00Z');
const TZ = 'Europe/London';

function run(over: Partial<WorkerRunRecord> = {}): WorkerRunRecord {
  return {
    workerId: 'daily_job',
    startedAt: new Date('2026-07-01T06:00:00Z'),
    finishedAt: new Date('2026-07-01T06:00:02Z'),
    outcome: 'success',
    ...over,
  };
}

describe('summariseWorkers (FR-U-7)', () => {
  it('renders one row per DECLARED worker, even one that has never run (FR-U-10)', () => {
    const rows = summariseWorkers({
      runs: [],
      pauses: [],
      now: NOW,
      timeZone: TZ,
      catalogue: CATALOGUE,
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]!.lastRunAt).toBeNull();
    expect(rows[0]!.lastOutcome).toBeNull();
    expect(rows[0]!.averageRuntimeMs).toBeNull();
    expect(rows[0]!.runCount).toBe(0);
  });

  it('reports the LATEST run as "last run", not merely the last row supplied', () => {
    const rows = summariseWorkers({
      runs: [
        run({ startedAt: new Date('2026-07-01T06:00:00Z'), outcome: 'success' }),
        run({ startedAt: new Date('2026-06-29T06:00:00Z'), outcome: 'failed' }), // older, listed later
      ],
      pauses: [],
      now: NOW,
      timeZone: TZ,
      catalogue: CATALOGUE,
    });
    expect(rows[0]!.lastRunAt!.toISOString()).toBe('2026-07-01T06:00:00.000Z');
    expect(rows[0]!.lastOutcome).toBe('success');
  });

  it('surfaces a FAILED last run with its detail (the console must show breakage)', () => {
    const rows = summariseWorkers({
      runs: [run({ outcome: 'failed', detail: 'SMTP timeout' })],
      pauses: [],
      now: NOW,
      timeZone: TZ,
      catalogue: CATALOGUE,
    });
    expect(rows[0]!.lastOutcome).toBe('failed');
    expect(rows[0]!.lastDetail).toBe('SMTP timeout');
  });

  it('averages the runtime across every recorded run', () => {
    const rows = summariseWorkers({
      runs: [
        run({
          startedAt: new Date('2026-07-01T06:00:00Z'),
          finishedAt: new Date('2026-07-01T06:00:02Z'), // 2000ms
        }),
        run({
          startedAt: new Date('2026-06-30T06:00:00Z'),
          finishedAt: new Date('2026-06-30T06:00:04Z'), // 4000ms
        }),
      ],
      pauses: [],
      now: NOW,
      timeZone: TZ,
      catalogue: CATALOGUE,
    });
    expect(rows[0]!.averageRuntimeMs).toBe(3000);
    expect(rows[0]!.runCount).toBe(2);
  });

  it('computes the next run for a scheduled worker and leaves it null for an interval one', () => {
    const rows = summariseWorkers({
      runs: [],
      pauses: [],
      now: NOW,
      timeZone: TZ,
      catalogue: CATALOGUE,
    });
    // Next 07:00 London after 12:00Z on 1 Jul = 06:00Z on 2 Jul (BST).
    expect(rows[0]!.nextRunAt!.toISOString()).toBe('2026-07-02T06:00:00.000Z');
    expect(rows[1]!.nextRunAt).toBeNull();
  });

  it('reports the pause state per worker (FR-U-8)', () => {
    const rows = summariseWorkers({
      runs: [],
      pauses: [{ workerId: 'daily_job', paused: true }],
      now: NOW,
      timeZone: TZ,
      catalogue: CATALOGUE,
    });
    expect(rows[0]!.paused).toBe(true);
    expect(rows[1]!.paused).toBe(false);
  });

  it('IGNORES a run row for a worker no longer declared (no phantom rows)', () => {
    const rows = summariseWorkers({
      runs: [run({ workerId: 'retired_job' })],
      pauses: [],
      now: NOW,
      timeZone: TZ,
      catalogue: CATALOGUE,
    });
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.runCount === 0)).toBe(true);
  });

  it('never attributes one worker run to another', () => {
    const rows = summariseWorkers({
      runs: [run({ workerId: 'interval_job' })],
      pauses: [],
      now: NOW,
      timeZone: TZ,
      catalogue: CATALOGUE,
    });
    expect(rows[0]!.runCount).toBe(0); // daily
    expect(rows[1]!.runCount).toBe(1); // interval
  });
});

describe('formatRuntime', () => {
  it('formats sub-second, seconds and minutes; null reads as em-dash', () => {
    expect(formatRuntime(null)).toBe('—');
    expect(formatRuntime(820)).toBe('820ms');
    expect(formatRuntime(1400)).toBe('1.4s');
    expect(formatRuntime(125_000)).toBe('2m 05s');
  });
});
