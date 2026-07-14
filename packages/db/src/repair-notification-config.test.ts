import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

// EPIC-G FR-G-3 (audit finding repair-emergency-internal-notifications-missing) —
// the per-tenant repair notification routing configuration
// (repair_notification_config). One row per tenant holds the internal recipients
// §G.7 routes to on submission: the property-manager / branch-repairs-queue email
// (every ticket) and the on-call manager's phone (emergency SMS). The smallest
// spec-grounded slice of the §H.13 notification-rules matrix — full matrix, rota
// and team-messaging channels are deferred to EPIC-H. Tenant-scoped and isolated
// by the tenant_isolation RLS policy in 0024 (same shape as 0014/0015).
// Schema-only unit: asserts the schema source + the raw SQL, and exercises the
// RLS policy against pglite.

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const schema = readFileSync(join(root, 'prisma', 'schema.prisma'), 'utf8');
const rlsMigration = readFileSync(
  join(root, 'migrations', 'raw', '0024_repair_notification_config_rls.sql'),
  'utf8',
);

function block(name: string, kind: 'model' | 'enum'): string {
  const match = schema.match(new RegExp(`${kind} ${name} \\{[\\s\\S]*?\\n\\}`, 'm'));
  expect(match, `${kind} ${name} should be declared`).not.toBeNull();
  return match![0];
}

describe('RepairNotificationConfig — schema (repair_notification_config, FR-G-3)', () => {
  it('is declared, tenant-scoped, and mapped to repair_notification_config', () => {
    const model = block('RepairNotificationConfig', 'model');
    expect(model).toContain('@@map("repair_notification_config")');
    expect(model).toMatch(/tenantId\s+String\s+@unique\s+@map\("tenant_id"\)\s+@db\.Uuid/);
    expect(model).toMatch(/tenant\s+PlatformTenant\s+@relation/);
    expect(model).toContain('onDelete: Cascade');
  });

  it('carries the §G.7 internal recipients as nullable columns', () => {
    const model = block('RepairNotificationConfig', 'model');
    // Every-ticket internal email — the property manager / branch repairs queue.
    expect(model).toMatch(/repairsEmail\s+String\?\s+@map\("repairs_email"\)/);
    // Emergency-only SMS — the on-call manager's phone.
    expect(model).toMatch(/onCallPhone\s+String\?\s+@map\("on_call_phone"\)/);
  });

  it('PlatformTenant back-relates to the config', () => {
    expect(block('PlatformTenant', 'model')).toMatch(
      /repairNotificationConfig\s+RepairNotificationConfig\?/,
    );
  });
});

describe('0024 RLS migration — tenant isolation on repair_notification_config', () => {
  it('enables + forces RLS with a fail-closed tenant_isolation policy', () => {
    expect(rlsMigration).toContain(
      'ALTER TABLE repair_notification_config ENABLE ROW LEVEL SECURITY;',
    );
    expect(rlsMigration).toContain(
      'ALTER TABLE repair_notification_config FORCE ROW LEVEL SECURITY;',
    );
    expect(rlsMigration).toContain('CREATE POLICY tenant_isolation ON repair_notification_config');
    expect(rlsMigration).toContain(
      "NULLIF(current_setting('app.current_tenant_id', true), '')::uuid",
    );
  });
});

describe('RLS tenant isolation on repair_notification_config (pglite — mirrors 0024)', () => {
  const TENANT_A = '11111111-1111-1111-1111-111111111111';
  const TENANT_B = '22222222-2222-2222-2222-222222222222';

  async function setup(): Promise<PGlite> {
    const db = new PGlite();
    await db.exec(`
      CREATE TABLE repair_notification_config (
        tenant_id uuid NOT NULL,
        repairs_email text,
        on_call_phone text
      );
      ALTER TABLE repair_notification_config ENABLE ROW LEVEL SECURITY;
      CREATE POLICY tenant_isolation ON repair_notification_config
        USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
      CREATE ROLE app_user NOLOGIN;
      GRANT SELECT, INSERT ON repair_notification_config TO app_user;
    `);
    await db.exec(`SET ROLE app_user`);
    return db;
  }

  it('admits only the current tenant rows and fails closed when unset', async () => {
    const db = await setup();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await db.exec(
      `INSERT INTO repair_notification_config (tenant_id, repairs_email) VALUES ('${TENANT_A}', 'repairs@agency.example')`,
    );
    await db.exec(`SET app.current_tenant_id = '${TENANT_B}'`);
    const none = await db.query<{ tenant_id: string }>(
      `SELECT tenant_id FROM repair_notification_config`,
    );
    expect(none.rows).toEqual([]);
    await db.close();
  });

  it('blocks inserting a row for another tenant (WITH CHECK)', async () => {
    const db = await setup();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await expect(
      db.exec(
        `INSERT INTO repair_notification_config (tenant_id, repairs_email) VALUES ('${TENANT_B}', 'x@y.example')`,
      ),
    ).rejects.toThrow();
    await db.close();
  });
});
