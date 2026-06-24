import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

// EPIC-H FR-H-4 (master spec §H.6) — the `assignment_rules` entity stores a
// tenant's no-code enquiry-routing rules: one row per IF/THEN rule, ordered by
// `position` so the runtime router can evaluate them top-down, first-match-wins.
// The IF conditions and the THEN assignment are JSONB (validated by
// @estate/validators on write). Tenant-scoped, isolated by the tenant_isolation
// RLS policy in 0018 (same shape as 0013/0014/0016). Schema-only unit: asserts the
// schema source + the raw SQL, and exercises the RLS policy against pglite.

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const schema = readFileSync(join(root, 'prisma', 'schema.prisma'), 'utf8');
const rlsMigration = readFileSync(
  join(root, 'migrations', 'raw', '0018_assignment_rules_rls.sql'),
  'utf8',
);

function block(name: string, kind: 'model' | 'enum'): string {
  const match = schema.match(new RegExp(`${kind} ${name} \\{[\\s\\S]*?\\n\\}`, 'm'));
  expect(match, `${kind} ${name} should be declared`).not.toBeNull();
  return match![0];
}

describe('AssignmentRule — schema (assignment_rules, master spec §H.6, FR-H-4)', () => {
  it('is declared, tenant-scoped, and mapped to assignment_rules', () => {
    const model = block('AssignmentRule', 'model');
    expect(model).toContain('@@map("assignment_rules")');
    expect(model).toMatch(/tenantId\s+String\s+@map\("tenant_id"\)\s+@db\.Uuid/);
    expect(model).toContain('@@index([tenantId])');
  });

  it('stores the rule name, IF conditions and THEN assignment', () => {
    const model = block('AssignmentRule', 'model');
    expect(model).toMatch(/name\s+String/);
    expect(model).toMatch(/conditions\s+Json/);
    expect(model).toMatch(/assignment\s+Json/);
  });

  it('orders rules per tenant with a position column (first-match-wins ordering)', () => {
    const model = block('AssignmentRule', 'model');
    expect(model).toMatch(/position\s+Int/);
    expect(model).toContain('@@index([tenantId, position])');
  });

  it('carries an enabled flag and created/updated timestamps', () => {
    const model = block('AssignmentRule', 'model');
    expect(model).toMatch(/isEnabled\s+Boolean\s+@default\(true\)\s+@map\("is_enabled"\)/);
    expect(model).toMatch(/createdAt\s+DateTime\s+@default\(now\(\)\)\s+@map\("created_at"\)/);
    expect(model).toMatch(/updatedAt\s+DateTime\s+@updatedAt\s+@map\("updated_at"\)/);
  });

  it('cascades from the tenant and back-relates from PlatformTenant', () => {
    const model = block('AssignmentRule', 'model');
    expect(model).toMatch(/tenant\s+PlatformTenant\s+@relation\([^)]*onDelete:\s*Cascade/);
    expect(block('PlatformTenant', 'model')).toMatch(/assignmentRules\s+AssignmentRule\[\]/);
  });
});

describe('0018 RLS migration — tenant isolation on assignment_rules', () => {
  it('enables + forces RLS with a fail-closed tenant_isolation policy', () => {
    expect(rlsMigration).toContain('ALTER TABLE assignment_rules ENABLE ROW LEVEL SECURITY;');
    expect(rlsMigration).toContain('ALTER TABLE assignment_rules FORCE ROW LEVEL SECURITY;');
    expect(rlsMigration).toContain('CREATE POLICY tenant_isolation ON assignment_rules');
    expect(rlsMigration).toContain(
      "NULLIF(current_setting('app.current_tenant_id', true), '')::uuid",
    );
  });
});

describe('RLS tenant isolation on assignment_rules (pglite — mirrors 0018)', () => {
  const TENANT_A = '11111111-1111-1111-1111-111111111111';
  const TENANT_B = '22222222-2222-2222-2222-222222222222';

  async function setup(): Promise<PGlite> {
    const db = new PGlite();
    await db.exec(`
      CREATE TABLE assignment_rules (
        tenant_id uuid NOT NULL,
        name text NOT NULL,
        position int NOT NULL
      );
      ALTER TABLE assignment_rules ENABLE ROW LEVEL SECURITY;
      CREATE POLICY tenant_isolation ON assignment_rules
        USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
      CREATE ROLE app_user NOLOGIN;
      GRANT SELECT, INSERT ON assignment_rules TO app_user;
    `);
    await db.exec(`SET ROLE app_user`);
    return db;
  }

  it('admits only the current tenant rows and fails closed when unset', async () => {
    const db = await setup();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await db.exec(
      `INSERT INTO assignment_rules (tenant_id, name, position) VALUES ('${TENANT_A}', 'Buyers to A', 0)`,
    );
    await db.exec(`SET app.current_tenant_id = '${TENANT_B}'`);
    const none = await db.query<{ name: string }>(`SELECT name FROM assignment_rules`);
    expect(none.rows).toEqual([]);
    await db.close();
  });

  it('blocks inserting a row for another tenant (WITH CHECK)', async () => {
    const db = await setup();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await expect(
      db.exec(
        `INSERT INTO assignment_rules (tenant_id, name, position) VALUES ('${TENANT_B}', 'X', 0)`,
      ),
    ).rejects.toThrow();
    await db.close();
  });
});
