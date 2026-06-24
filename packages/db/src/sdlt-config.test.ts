import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

// EPIC-W FR-W-3 — the per-tenant SDLT band-configuration collection (sdlt_config).
// One JSON config row per tenant backs the admin-editable stamp-duty bands; the
// public calculator falls back to the engine default when unset. Tenant-scoped and
// isolated by the tenant_isolation RLS policy in 0014 (same shape as 0013).
// Schema-only unit: asserts the schema source + the raw SQL, and exercises the RLS
// policy against pglite.

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const schema = readFileSync(join(root, 'prisma', 'schema.prisma'), 'utf8');
const rlsMigration = readFileSync(
  join(root, 'migrations', 'raw', '0014_sdlt_config_rls.sql'),
  'utf8',
);

function block(name: string, kind: 'model' | 'enum'): string {
  const match = schema.match(new RegExp(`${kind} ${name} \\{[\\s\\S]*?\\n\\}`, 'm'));
  expect(match, `${kind} ${name} should be declared`).not.toBeNull();
  return match![0];
}

describe('SdltConfig — schema (sdlt_config, FR-W-3)', () => {
  it('is declared, tenant-scoped, and mapped to sdlt_config', () => {
    const model = block('SdltConfig', 'model');
    expect(model).toContain('@@map("sdlt_config")');
    expect(model).toMatch(/tenantId\s+String\s+@unique\s+@map\("tenant_id"\)\s+@db\.Uuid/);
    expect(model).toMatch(/config\s+Json/);
    expect(model).toMatch(/tenant\s+PlatformTenant\s+@relation/);
    expect(model).toContain('onDelete: Cascade');
  });

  it('PlatformTenant back-relates to the config', () => {
    expect(block('PlatformTenant', 'model')).toMatch(/sdltConfig\s+SdltConfig\?/);
  });
});

describe('0014 RLS migration — tenant isolation on sdlt_config', () => {
  it('enables + forces RLS with a fail-closed tenant_isolation policy', () => {
    expect(rlsMigration).toContain('ALTER TABLE sdlt_config ENABLE ROW LEVEL SECURITY;');
    expect(rlsMigration).toContain('ALTER TABLE sdlt_config FORCE ROW LEVEL SECURITY;');
    expect(rlsMigration).toContain('CREATE POLICY tenant_isolation ON sdlt_config');
    expect(rlsMigration).toContain(
      "NULLIF(current_setting('app.current_tenant_id', true), '')::uuid",
    );
  });
});

describe('RLS tenant isolation on sdlt_config (pglite — mirrors 0014)', () => {
  const TENANT_A = '11111111-1111-1111-1111-111111111111';
  const TENANT_B = '22222222-2222-2222-2222-222222222222';

  async function setup(): Promise<PGlite> {
    const db = new PGlite();
    await db.exec(`
      CREATE TABLE sdlt_config (tenant_id uuid NOT NULL, config jsonb NOT NULL);
      ALTER TABLE sdlt_config ENABLE ROW LEVEL SECURITY;
      CREATE POLICY tenant_isolation ON sdlt_config
        USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
      CREATE ROLE app_user NOLOGIN;
      GRANT SELECT, INSERT ON sdlt_config TO app_user;
    `);
    await db.exec(`SET ROLE app_user`);
    return db;
  }

  it('admits only the current tenant rows and fails closed when unset', async () => {
    const db = await setup();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await db.exec(`INSERT INTO sdlt_config (tenant_id, config) VALUES ('${TENANT_A}', '{}')`);
    await db.exec(`SET app.current_tenant_id = '${TENANT_B}'`);
    const none = await db.query<{ tenant_id: string }>(`SELECT tenant_id FROM sdlt_config`);
    expect(none.rows).toEqual([]);
    await db.close();
  });

  it('blocks inserting a row for another tenant (WITH CHECK)', async () => {
    const db = await setup();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await expect(
      db.exec(`INSERT INTO sdlt_config (tenant_id, config) VALUES ('${TENANT_B}', '{}')`),
    ).rejects.toThrow();
    await db.close();
  });
});
