import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

// EPIC-G contractors (master spec §G.6, FR-G-8) — the contractor directory a
// staff member assigns repair tickets to. Tenant-scoped, isolated by the
// tenant_isolation RLS policy in 0011 (same shape as 0003/0005/0007/0008/0009/0010).
// Schema-only unit: asserts the schema source text + the raw SQL, and exercises
// the RLS policy against pglite.

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const schema = readFileSync(join(root, 'prisma', 'schema.prisma'), 'utf8');
const rlsMigration = readFileSync(
  join(root, 'migrations', 'raw', '0011_contractors_rls.sql'),
  'utf8',
);

function block(name: string, kind: 'model' | 'enum'): string {
  const match = schema.match(new RegExp(`${kind} ${name} \\{[\\s\\S]*?\\n\\}`, 'm'));
  expect(match, `${kind} ${name} should be declared`).not.toBeNull();
  return match![0];
}

describe('Contractor — schema (contractors, master spec §G.6)', () => {
  it('is declared, tenant-scoped, and mapped to contractors', () => {
    const model = block('Contractor', 'model');
    expect(model).toContain('@@map("contractors")');
    expect(model).toMatch(/tenantId\s+String\s+@map\("tenant_id"\)\s+@db\.Uuid/);
    expect(model).toContain('@@index([tenantId])');
    expect(model).toMatch(/tenant\s+PlatformTenant\s+@relation/);
  });

  it('carries the directory columns', () => {
    const model = block('Contractor', 'model');
    expect(model).toMatch(/name\s+String/);
    expect(model).toMatch(/email\s+String/);
    expect(model).toMatch(/phone\s+String\?/);
    expect(model).toMatch(/trade\s+String\?/);
    expect(model).toMatch(/active\s+Boolean\s+@default\(true\)/);
  });
});

describe('0011 RLS migration — tenant isolation on contractors', () => {
  it('enables + forces RLS with a fail-closed tenant_isolation policy', () => {
    expect(rlsMigration).toContain('ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;');
    expect(rlsMigration).toContain('ALTER TABLE contractors FORCE ROW LEVEL SECURITY;');
    expect(rlsMigration).toContain('CREATE POLICY tenant_isolation ON contractors');
    expect(rlsMigration).toContain(
      "NULLIF(current_setting('app.current_tenant_id', true), '')::uuid",
    );
  });
});

describe('RLS tenant isolation on contractors (pglite — mirrors 0011)', () => {
  const TENANT_A = '11111111-1111-1111-1111-111111111111';
  const TENANT_B = '22222222-2222-2222-2222-222222222222';

  async function setup(): Promise<PGlite> {
    const db = new PGlite();
    await db.exec(`
      CREATE TABLE contractors (tenant_id uuid NOT NULL, name text NOT NULL);
      ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;
      CREATE POLICY tenant_isolation ON contractors
        USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
      CREATE ROLE app_user NOLOGIN;
      GRANT SELECT, INSERT ON contractors TO app_user;
    `);
    await db.exec(`SET ROLE app_user`);
    return db;
  }

  it('admits only the current tenant rows and fails closed when unset', async () => {
    const db = await setup();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await db.exec(
      `INSERT INTO contractors (tenant_id, name) VALUES ('${TENANT_A}','Ace Plumbing')`,
    );
    await db.exec(`SET app.current_tenant_id = '${TENANT_B}'`);
    const none = await db.query<{ name: string }>(`SELECT name FROM contractors`);
    expect(none.rows).toEqual([]);
    await db.close();
  });

  it('blocks inserting a row for another tenant (WITH CHECK)', async () => {
    const db = await setup();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await expect(
      db.exec(`INSERT INTO contractors (tenant_id, name) VALUES ('${TENANT_B}','Bodge It')`),
    ).rejects.toThrow();
    await db.close();
  });
});
