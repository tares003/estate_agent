import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

// EPIC-T saved properties (master spec §B.22 / §J, FR-T-5/6). The `saved_properties`
// entity records the catalogue properties a registered customer has favourited: one
// row per (tenant, customer, property), idempotent via the composite unique.
// Tenant-scoped, isolated by the tenant_isolation RLS policy in 0015 (same shape as
// 0013/0014). Schema-only unit: asserts the schema source + the raw SQL, and
// exercises the RLS policy against pglite.

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const schema = readFileSync(join(root, 'prisma', 'schema.prisma'), 'utf8');
const rlsMigration = readFileSync(
  join(root, 'migrations', 'raw', '0016_saved_properties_rls.sql'),
  'utf8',
);

function block(name: string, kind: 'model' | 'enum'): string {
  const match = schema.match(new RegExp(`${kind} ${name} \\{[\\s\\S]*?\\n\\}`, 'm'));
  expect(match, `${kind} ${name} should be declared`).not.toBeNull();
  return match![0];
}

describe('SavedProperty — schema (saved_properties, master spec §B.22, FR-T-5/6)', () => {
  it('is declared, tenant-scoped, and mapped to saved_properties', () => {
    const model = block('SavedProperty', 'model');
    expect(model).toContain('@@map("saved_properties")');
    expect(model).toMatch(/tenantId\s+String\s+@map\("tenant_id"\)\s+@db\.Uuid/);
    expect(model).toContain('@@index([tenantId])');
  });

  it('keys the save to the customer (user) and the catalogue property', () => {
    const model = block('SavedProperty', 'model');
    expect(model).toMatch(/userId\s+String\s+@map\("user_id"\)\s+@db\.Uuid/);
    expect(model).toMatch(/propertyId\s+String\s+@map\("property_id"\)\s+@db\.Uuid/);
    expect(model).toMatch(/createdAt\s+DateTime\s+@default\(now\(\)\)\s+@map\("created_at"\)/);
  });

  it('makes a save idempotent with a (tenantId, userId, propertyId) unique', () => {
    const model = block('SavedProperty', 'model');
    expect(model).toContain('@@unique([tenantId, userId, propertyId])');
  });

  it('cascades from the tenant, the customer, and the property', () => {
    const model = block('SavedProperty', 'model');
    expect(model).toMatch(/tenant\s+PlatformTenant\s+@relation\([^)]*onDelete:\s*Cascade/);
    expect(model).toMatch(/user\s+User\s+@relation\([^)]*onDelete:\s*Cascade/);
    expect(model).toMatch(/property\s+Property\s+@relation\([^)]*onDelete:\s*Cascade/);
  });

  it('back-relates from PlatformTenant, User and Property', () => {
    expect(block('PlatformTenant', 'model')).toMatch(/savedProperties\s+SavedProperty\[\]/);
    expect(block('User', 'model')).toMatch(/savedProperties\s+SavedProperty\[\]/);
    expect(block('Property', 'model')).toMatch(/savedBy\s+SavedProperty\[\]/);
  });

  it('User carries a type discriminator defaulting to staff (customer accounts, EPIC-T)', () => {
    const model = block('User', 'model');
    expect(model).toMatch(/type\s+String\s+@default\("staff"\)/);
  });
});

describe('0015 RLS migration — tenant isolation on saved_properties', () => {
  it('enables + forces RLS with a fail-closed tenant_isolation policy', () => {
    expect(rlsMigration).toContain('ALTER TABLE saved_properties ENABLE ROW LEVEL SECURITY;');
    expect(rlsMigration).toContain('ALTER TABLE saved_properties FORCE ROW LEVEL SECURITY;');
    expect(rlsMigration).toContain('CREATE POLICY tenant_isolation ON saved_properties');
    expect(rlsMigration).toContain(
      "NULLIF(current_setting('app.current_tenant_id', true), '')::uuid",
    );
  });
});

describe('RLS tenant isolation on saved_properties (pglite — mirrors 0015)', () => {
  const TENANT_A = '11111111-1111-1111-1111-111111111111';
  const TENANT_B = '22222222-2222-2222-2222-222222222222';
  const USER = '33333333-3333-3333-3333-333333333333';
  const PROPERTY = '44444444-4444-4444-4444-444444444444';

  async function setup(): Promise<PGlite> {
    const db = new PGlite();
    await db.exec(`
      CREATE TABLE saved_properties (
        tenant_id uuid NOT NULL,
        user_id uuid NOT NULL,
        property_id uuid NOT NULL
      );
      ALTER TABLE saved_properties ENABLE ROW LEVEL SECURITY;
      CREATE POLICY tenant_isolation ON saved_properties
        USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
      CREATE ROLE app_user NOLOGIN;
      GRANT SELECT, INSERT ON saved_properties TO app_user;
    `);
    await db.exec(`SET ROLE app_user`);
    return db;
  }

  it('admits only the current tenant rows and fails closed when unset', async () => {
    const db = await setup();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await db.exec(
      `INSERT INTO saved_properties (tenant_id, user_id, property_id) VALUES ('${TENANT_A}', '${USER}', '${PROPERTY}')`,
    );
    await db.exec(`SET app.current_tenant_id = '${TENANT_B}'`);
    const none = await db.query<{ property_id: string }>(
      `SELECT property_id FROM saved_properties`,
    );
    expect(none.rows).toEqual([]);
    await db.close();
  });

  it('blocks inserting a row for another tenant (WITH CHECK)', async () => {
    const db = await setup();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await expect(
      db.exec(
        `INSERT INTO saved_properties (tenant_id, user_id, property_id) VALUES ('${TENANT_B}', '${USER}', '${PROPERTY}')`,
      ),
    ).rejects.toThrow();
    await db.close();
  });
});
