import { describe, expect, it } from 'vitest';

import { WORKER_CATALOGUE, findWorker, workerIds } from './catalogue.js';

// EPIC-U FR-U-10 — a new worker is added by ONE declaration here and the console picks
// it up automatically. These tests pin the contract the console relies on.

describe('WORKER_CATALOGUE (FR-U-10)', () => {
  it('declares a stable, unique id for every worker (the run-log key)', () => {
    const ids = workerIds();
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThan(0);
  });

  it('gives every worker the fields the §H.23 console table renders', () => {
    for (const worker of WORKER_CATALOGUE) {
      expect(worker.id).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(worker.name.length).toBeGreaterThan(0);
      expect(worker.description.length).toBeGreaterThan(0);
      expect(worker.schedule.length).toBeGreaterThan(0);
      expect(['interval', 'daily', 'weekly']).toContain(worker.cadence);
    }
  });

  it('gives every daily/weekly worker the tenant-local hour it must fire at (FR-U-9)', () => {
    for (const worker of WORKER_CATALOGUE) {
      if (worker.cadence === 'interval') {
        expect(worker.localHour).toBeUndefined();
        continue;
      }
      expect(worker.localHour).toBeGreaterThanOrEqual(0);
      expect(worker.localHour).toBeLessThanOrEqual(23);
      if (worker.cadence === 'weekly') {
        expect(worker.localWeekday).toBeGreaterThanOrEqual(1);
        expect(worker.localWeekday).toBeLessThanOrEqual(7);
      }
    }
  });

  it('declares the workers that actually exist (the console must not show phantoms)', () => {
    // Only BUILT workers are declared — a "last run: never" row for a job that does not
    // exist would be worse than no row (master spec §H.23 lists more than are built).
    expect(workerIds()).toEqual([
      'email_send',
      'sms_send',
      'image_processing',
      'saved_search_instant',
      'saved_search_daily',
      'saved_search_weekly',
    ]);
  });
});

describe('findWorker', () => {
  it('resolves a declared id and rejects an unknown one', () => {
    expect(findWorker('saved_search_daily')?.cadence).toBe('daily');
    expect(findWorker('no_such_worker')).toBeUndefined();
  });
});
