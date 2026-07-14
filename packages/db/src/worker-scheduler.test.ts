import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

// EPIC-U FR-U-7 / FR-U-8 / FR-U-9 — the scheduled-tasks entities behind /admin/scheduled-tasks
// (master spec §H.23).
//
//   worker_runs      the run log the console reads (last run, outcome, average runtime).
//                    A "run" is ONE TENANT's slice of a worker tick, because the console is
//                    a TENANT surface: a tenant sees only its own history, and "average
//                    runtime" means the runtime of its own work.
//   worker_schedules the per-tenant control state: the FR-U-8 pause flag and the pending
//                    Run-now request the worker tick picks up and clears.
//   PlatformTenant.timezone  the zone the daily/weekly digests are scheduled against
//                    (FR-U-9 — "the digest should arrive at 7am MY time").
//
// Both tables are tenant-scoped and isolated by the tenant_isolation policy in 0026 (same
// shape as 0024/0025). Schema-only unit: asserts the schema source + the raw SQL, and
// exercises the RLS policy against pglite.

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const schema = readFileSync(join(root, 'prisma', 'schema.prisma'), 'utf8');
const rlsMigration = readFileSync(
  join(root, 'migrations', 'raw', '0026_worker_scheduler_rls.sql'),
  'utf8',
);

function block(name: string, kind: 'model' | 'enum'): string {
  const match = schema.match(new RegExp(`${kind} ${name} \\{[\\s\\S]*?\\n\\}`, 'm'));
  expect(match, `${kind} ${name} should be declared`).not.toBeNull();
  return match![0];
}

describe('PlatformTenant.timezone (FR-U-9)', () => {
  it('carries the tenant IANA zone, defaulted to Europe/London', () => {
    const model = block('PlatformTenant', 'model');
    expect(model).toMatch(/timezone\s+String\s+@default\("Europe\/London"\)/);
  });
});

describe('WorkerRun — schema (worker_runs, FR-U-7)', () => {
  it('is declared, tenant-scoped, and mapped to worker_runs', () => {
    const model = block('WorkerRun', 'model');
    expect(model).toContain('@@map("worker_runs")');
    expect(model).toMatch(/tenantId\s+String\s+@map\("tenant_id"\)\s+@db\.Uuid/);
    expect(model).toMatch(/tenant\s+PlatformTenant\s+@relation/);
    expect(model).toContain('onDelete: Cascade');
  });

  it('records what the §H.23 console columns need: which worker, when, and how it ended', () => {
    const model = block('WorkerRun', 'model');
    expect(model).toMatch(/workerId\s+String\s+@map\("worker_id"\)/);
    expect(model).toMatch(/startedAt\s+DateTime\s+@map\("started_at"\)/);
    expect(model).toMatch(/finishedAt\s+DateTime\s+@map\("finished_at"\)/);
    expect(model).toMatch(/outcome\s+String/);
    // The failure message on a failed run, or a counts summary on a successful one.
    expect(model).toMatch(/detail\s+String\?/);
  });

  it('indexes the lookup the console and the once-per-local-day guard both make', () => {
    expect(block('WorkerRun', 'model')).toContain('@@index([tenantId, workerId, startedAt])');
  });
});

describe('WorkerSchedule — schema (worker_schedules, FR-U-8)', () => {
  it('is declared, tenant-scoped, and mapped to worker_schedules', () => {
    const model = block('WorkerSchedule', 'model');
    expect(model).toContain('@@map("worker_schedules")');
    expect(model).toMatch(/tenantId\s+String\s+@map\("tenant_id"\)\s+@db\.Uuid/);
    expect(model).toContain('onDelete: Cascade');
  });

  it('carries the pause flag and the pending Run-now request', () => {
    const model = block('WorkerSchedule', 'model');
    expect(model).toMatch(/paused\s+Boolean\s+@default\(false\)/);
    expect(model).toMatch(/runRequestedAt\s+DateTime\?\s+@map\("run_requested_at"\)/);
  });

  it('holds at most one control row per worker per tenant', () => {
    expect(block('WorkerSchedule', 'model')).toContain('@@unique([tenantId, workerId])');
  });
});

describe('0026 RLS migration — tenant isolation on the scheduler tables', () => {
  it('enables + forces RLS with a fail-closed tenant_isolation policy on both tables', () => {
    for (const table of ['worker_runs', 'worker_schedules']) {
      expect(rlsMigration).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
      expect(rlsMigration).toContain(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`);
      expect(rlsMigration).toContain(`CREATE POLICY tenant_isolation ON ${table}`);
    }
    expect(rlsMigration).toContain(
      "NULLIF(current_setting('app.current_tenant_id', true), '')::uuid",
    );
  });
});

describe('RLS tenant isolation on worker_runs + worker_schedules (pglite — mirrors 0026)', () => {
  const TENANT_A = '11111111-1111-1111-1111-111111111111';
  const TENANT_B = '22222222-2222-2222-2222-222222222222';

  async function setup(): Promise<PGlite> {
    const db = new PGlite();
    await db.exec(`
      CREATE TABLE worker_runs (
        tenant_id uuid NOT NULL,
        worker_id text NOT NULL,
        started_at timestamptz NOT NULL DEFAULT now(),
        finished_at timestamptz NOT NULL DEFAULT now(),
        outcome text NOT NULL,
        detail text
      );
      CREATE TABLE worker_schedules (
        tenant_id uuid NOT NULL,
        worker_id text NOT NULL,
        paused boolean NOT NULL DEFAULT false,
        run_requested_at timestamptz
      );
      ALTER TABLE worker_runs ENABLE ROW LEVEL SECURITY;
      CREATE POLICY tenant_isolation ON worker_runs
        USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
      ALTER TABLE worker_schedules ENABLE ROW LEVEL SECURITY;
      CREATE POLICY tenant_isolation ON worker_schedules
        USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
      CREATE ROLE app_user NOLOGIN;
      GRANT SELECT, INSERT ON worker_runs TO app_user;
      GRANT SELECT, INSERT ON worker_schedules TO app_user;
    `);
    await db.exec(`SET ROLE app_user`);
    return db;
  }

  it('admits only the current tenant run rows and fails closed when unset', async () => {
    const db = await setup();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await db.exec(
      `INSERT INTO worker_runs (tenant_id, worker_id, outcome) VALUES ('${TENANT_A}', 'saved_search_daily', 'success')`,
    );

    // One tenant must never read another's worker history.
    await db.exec(`SET app.current_tenant_id = '${TENANT_B}'`);
    const none = await db.query<{ tenant_id: string }>(`SELECT tenant_id FROM worker_runs`);
    expect(none.rows).toEqual([]);

    // Unscoped connection: the GUC is empty, NULLIF yields NULL, no rows (fail-closed).
    await db.exec(`SET app.current_tenant_id = ''`);
    const unscoped = await db.query<{ tenant_id: string }>(`SELECT tenant_id FROM worker_runs`);
    expect(unscoped.rows).toEqual([]);
    await db.close();
  });

  it('blocks recording a run against another tenant (WITH CHECK)', async () => {
    const db = await setup();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await expect(
      db.exec(
        `INSERT INTO worker_runs (tenant_id, worker_id, outcome) VALUES ('${TENANT_B}', 'saved_search_daily', 'success')`,
      ),
    ).rejects.toThrow();
    await db.close();
  });

  it('isolates the pause flag, so one tenant cannot pause another tenant’s worker', async () => {
    const db = await setup();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await db.exec(
      `INSERT INTO worker_schedules (tenant_id, worker_id, paused) VALUES ('${TENANT_A}', 'saved_search_daily', true)`,
    );

    await db.exec(`SET app.current_tenant_id = '${TENANT_B}'`);
    const none = await db.query<{ paused: boolean }>(`SELECT paused FROM worker_schedules`);
    expect(none.rows).toEqual([]);

    await expect(
      db.exec(
        `INSERT INTO worker_schedules (tenant_id, worker_id, paused) VALUES ('${TENANT_A}', 'saved_search_weekly', true)`,
      ),
    ).rejects.toThrow();
    await db.close();
  });
});
