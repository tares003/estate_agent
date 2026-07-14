import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

// EPIC-G FR-G-5 / FR-G-9 (audit finding repair-urgency-sla-not-configurable) — the
// per-tenant repair SLA configuration (repair_sla_config). One row per tenant holds
// the per-urgency SLA targets of master spec §G.4 (emergency / urgent / standard in
// hours, non-urgent in working days) and the two FR-G-9 badge thresholds (due-soon
// and at-risk, as a percentage of the target elapsed; breach stays fixed at 100%).
// Tenant-scoped and isolated by the tenant_isolation RLS policy in 0025 (same shape
// as 0014/0015/0024). Schema-only unit: asserts the schema source + the raw SQL, and
// exercises the RLS policy against pglite.

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const schema = readFileSync(join(root, 'prisma', 'schema.prisma'), 'utf8');
const rlsMigration = readFileSync(
  join(root, 'migrations', 'raw', '0025_repair_sla_config_rls.sql'),
  'utf8',
);

function block(name: string, kind: 'model' | 'enum'): string {
  const match = schema.match(new RegExp(`${kind} ${name} \\{[\\s\\S]*?\\n\\}`, 'm'));
  expect(match, `${kind} ${name} should be declared`).not.toBeNull();
  return match![0];
}

describe('RepairSlaConfig — schema (repair_sla_config, FR-G-5/FR-G-9)', () => {
  it('is declared, tenant-scoped, and mapped to repair_sla_config', () => {
    const model = block('RepairSlaConfig', 'model');
    expect(model).toContain('@@map("repair_sla_config")');
    expect(model).toMatch(/tenantId\s+String\s+@unique\s+@map\("tenant_id"\)\s+@db\.Uuid/);
    expect(model).toMatch(/tenant\s+PlatformTenant\s+@relation/);
    expect(model).toContain('onDelete: Cascade');
  });

  it('carries the §G.4 per-urgency targets, defaulted to the spec values', () => {
    const model = block('RepairSlaConfig', 'model');
    expect(model).toMatch(
      /emergencyTargetHours\s+Int\s+@default\(4\)\s+@map\("emergency_target_hours"\)/,
    );
    expect(model).toMatch(
      /urgentTargetHours\s+Int\s+@default\(24\)\s+@map\("urgent_target_hours"\)/,
    );
    expect(model).toMatch(
      /standardTargetHours\s+Int\s+@default\(48\)\s+@map\("standard_target_hours"\)/,
    );
    expect(model).toMatch(
      /lowTargetWorkingDays\s+Int\s+@default\(5\)\s+@map\("low_target_working_days"\)/,
    );
  });

  it('carries the FR-G-9 badge thresholds, defaulted to 50% / 75%', () => {
    const model = block('RepairSlaConfig', 'model');
    expect(model).toMatch(
      /dueSoonThresholdPercent\s+Int\s+@default\(50\)\s+@map\("due_soon_threshold_percent"\)/,
    );
    expect(model).toMatch(
      /atRiskThresholdPercent\s+Int\s+@default\(75\)\s+@map\("at_risk_threshold_percent"\)/,
    );
  });

  it('PlatformTenant back-relates to the config', () => {
    expect(block('PlatformTenant', 'model')).toMatch(/repairSlaConfig\s+RepairSlaConfig\?/);
  });
});

describe('0025 RLS migration — tenant isolation on repair_sla_config', () => {
  it('enables + forces RLS with a fail-closed tenant_isolation policy', () => {
    expect(rlsMigration).toContain('ALTER TABLE repair_sla_config ENABLE ROW LEVEL SECURITY;');
    expect(rlsMigration).toContain('ALTER TABLE repair_sla_config FORCE ROW LEVEL SECURITY;');
    expect(rlsMigration).toContain('CREATE POLICY tenant_isolation ON repair_sla_config');
    expect(rlsMigration).toContain(
      "NULLIF(current_setting('app.current_tenant_id', true), '')::uuid",
    );
  });
});

describe('RLS tenant isolation on repair_sla_config (pglite — mirrors 0025)', () => {
  const TENANT_A = '11111111-1111-1111-1111-111111111111';
  const TENANT_B = '22222222-2222-2222-2222-222222222222';

  async function setup(): Promise<PGlite> {
    const db = new PGlite();
    await db.exec(`
      CREATE TABLE repair_sla_config (
        tenant_id uuid NOT NULL,
        emergency_target_hours integer NOT NULL DEFAULT 4,
        urgent_target_hours integer NOT NULL DEFAULT 24,
        standard_target_hours integer NOT NULL DEFAULT 48,
        low_target_working_days integer NOT NULL DEFAULT 5,
        due_soon_threshold_percent integer NOT NULL DEFAULT 50,
        at_risk_threshold_percent integer NOT NULL DEFAULT 75
      );
      ALTER TABLE repair_sla_config ENABLE ROW LEVEL SECURITY;
      CREATE POLICY tenant_isolation ON repair_sla_config
        USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
      CREATE ROLE app_user NOLOGIN;
      GRANT SELECT, INSERT ON repair_sla_config TO app_user;
    `);
    await db.exec(`SET ROLE app_user`);
    return db;
  }

  it('admits only the current tenant rows and fails closed when unset', async () => {
    const db = await setup();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await db.exec(
      `INSERT INTO repair_sla_config (tenant_id, emergency_target_hours) VALUES ('${TENANT_A}', 2)`,
    );

    await db.exec(`SET app.current_tenant_id = '${TENANT_B}'`);
    const none = await db.query<{ tenant_id: string }>(`SELECT tenant_id FROM repair_sla_config`);
    expect(none.rows).toEqual([]);

    // Unscoped connection: the GUC is empty, NULLIF yields NULL, no rows (fail-closed).
    await db.exec(`SET app.current_tenant_id = ''`);
    const unscoped = await db.query<{ tenant_id: string }>(
      `SELECT tenant_id FROM repair_sla_config`,
    );
    expect(unscoped.rows).toEqual([]);
    await db.close();
  });

  it('blocks inserting a row for another tenant (WITH CHECK)', async () => {
    const db = await setup();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await expect(
      db.exec(
        `INSERT INTO repair_sla_config (tenant_id, emergency_target_hours) VALUES ('${TENANT_B}', 1)`,
      ),
    ).rejects.toThrow();
    await db.close();
  });
});
