import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

// EPIC-G repair categories (master spec §G.3, FR-G-4) — the admin-editable category
// catalogue. §G.3 stores categories in repair_categories so admins can edit labels,
// icons, default urgency, auto-assign role, order and visibility. Tenant-scoped,
// isolated by the tenant_isolation RLS policy in 0010 (same shape as
// 0003/0005/0007/0008/0009). Schema-only unit: asserts the schema source text + the
// raw SQL, and exercises the RLS policy against pglite.

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const schema = readFileSync(join(root, 'prisma', 'schema.prisma'), 'utf8');
const rlsMigration = readFileSync(
  join(root, 'migrations', 'raw', '0010_repair_categories_rls.sql'),
  'utf8',
);

function block(name: string, kind: 'model' | 'enum'): string {
  const match = schema.match(new RegExp(`${kind} ${name} \\{[\\s\\S]*?\\n\\}`, 'm'));
  expect(match, `${kind} ${name} should be declared`).not.toBeNull();
  return match![0];
}

describe('RepairCategory — schema (repair_categories, master spec §G.3)', () => {
  it('is declared, tenant-scoped, and mapped to repair_categories', () => {
    const model = block('RepairCategory', 'model');
    expect(model).toContain('@@map("repair_categories")');
    expect(model).toMatch(/tenantId\s+String\s+@map\("tenant_id"\)\s+@db\.Uuid/);
    expect(model).toContain('@@index([tenantId])');
    expect(model).toMatch(/tenant\s+PlatformTenant\s+@relation/);
  });

  it('carries the §G.3 columns', () => {
    const model = block('RepairCategory', 'model');
    expect(model).toMatch(/slug\s+String/);
    expect(model).toMatch(/label\s+String/);
    expect(model).toMatch(/icon\s+String\?/);
    expect(model).toMatch(/defaultUrgency\s+RepairUrgency\s+@map\("default_urgency"\)/);
    expect(model).toMatch(/autoAssignRole\s+String\?\s+@map\("auto_assign_role"\)/);
    expect(model).toMatch(/sortOrder\s+Int\s+@default\(0\)\s+@map\("sort_order"\)/);
    expect(model).toMatch(/visible\s+Boolean\s+@default\(true\)/);
  });

  it('is unique per tenant by slug (the admin edits one row per slug)', () => {
    const model = block('RepairCategory', 'model');
    expect(model).toMatch(/@@unique\(\[tenantId, slug\]\)/);
  });
});

describe('0010 RLS migration — tenant isolation on repair_categories', () => {
  it('enables + forces RLS with a fail-closed tenant_isolation policy', () => {
    expect(rlsMigration).toContain('ALTER TABLE repair_categories ENABLE ROW LEVEL SECURITY;');
    expect(rlsMigration).toContain('ALTER TABLE repair_categories FORCE ROW LEVEL SECURITY;');
    expect(rlsMigration).toContain('CREATE POLICY tenant_isolation ON repair_categories');
    expect(rlsMigration).toContain(
      "NULLIF(current_setting('app.current_tenant_id', true), '')::uuid",
    );
  });
});

describe('RLS tenant isolation on repair_categories (pglite — mirrors 0010)', () => {
  const TENANT_A = '11111111-1111-1111-1111-111111111111';
  const TENANT_B = '22222222-2222-2222-2222-222222222222';

  async function setup(): Promise<PGlite> {
    const db = new PGlite();
    await db.exec(`
      CREATE TABLE repair_categories (tenant_id uuid NOT NULL, slug text NOT NULL);
      ALTER TABLE repair_categories ENABLE ROW LEVEL SECURITY;
      CREATE POLICY tenant_isolation ON repair_categories
        USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
      CREATE ROLE app_user NOLOGIN;
      GRANT SELECT, INSERT ON repair_categories TO app_user;
    `);
    await db.exec(`SET ROLE app_user`);
    return db;
  }

  it('admits only the current tenant rows and fails closed when unset', async () => {
    const db = await setup();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await db.exec(`INSERT INTO repair_categories (tenant_id, slug) VALUES ('${TENANT_A}','plumbing')`);
    await db.exec(`SET app.current_tenant_id = '${TENANT_B}'`);
    const none = await db.query<{ slug: string }>(`SELECT slug FROM repair_categories`);
    expect(none.rows).toEqual([]);
    await db.close();
  });

  it('blocks inserting a row for another tenant (WITH CHECK)', async () => {
    const db = await setup();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await expect(
      db.exec(`INSERT INTO repair_categories (tenant_id, slug) VALUES ('${TENANT_B}','heating')`),
    ).rejects.toThrow();
    await db.close();
  });
});
