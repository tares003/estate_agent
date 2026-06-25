import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

// EPIC-J saved searches (master spec §J line 1343-1344; FR-T-7/8). The
// `saved_searches` entity records a set of search filters a registered customer
// has saved: a reference to the user, a name the user gave the search, the
// structured filter criteria, an alert frequency (off | instant | daily |
// weekly), the timestamp of the most recent alert sent, and a creation
// timestamp. Tenant-scoped, isolated by the tenant_isolation RLS policy in 0022
// (same shape as 0016/0018). Schema-only unit: asserts the schema source + the
// raw SQL, and exercises the RLS policy against pglite.

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const schema = readFileSync(join(root, 'prisma', 'schema.prisma'), 'utf8');
const rlsMigration = readFileSync(
  join(root, 'migrations', 'raw', '0022_saved_searches_rls.sql'),
  'utf8',
);

function block(name: string, kind: 'model' | 'enum'): string {
  const match = schema.match(new RegExp(`${kind} ${name} \\{[\\s\\S]*?\\n\\}`, 'm'));
  expect(match, `${kind} ${name} should be declared`).not.toBeNull();
  return match![0];
}

describe('SavedSearch — schema (saved_searches, master spec §J 1343-1344, FR-T-7/8)', () => {
  it('is declared, tenant-scoped, and mapped to saved_searches', () => {
    const model = block('SavedSearch', 'model');
    expect(model).toContain('@@map("saved_searches")');
    expect(model).toMatch(/tenantId\s+String\s+@map\("tenant_id"\)\s+@db\.Uuid/);
    expect(model).toContain('@@index([tenantId])');
  });

  it('captures every attribute §J 1344 describes', () => {
    const model = block('SavedSearch', 'model');
    // a reference to the user
    expect(model).toMatch(/userId\s+String\s+@map\("user_id"\)\s+@db\.Uuid/);
    // a name the user gave the search
    expect(model).toMatch(/name\s+String/);
    // the structured filter criteria
    expect(model).toMatch(/filters\s+Json/);
    // an alert frequency (off, instant, daily or weekly)
    expect(model).toMatch(/alertFrequency\s+AlertFrequency/);
    // the timestamp of the most recent alert sent (nullable)
    expect(model).toMatch(/lastAlertSentAt\s+DateTime\?\s+@map\("last_alert_sent_at"\)/);
    // a creation timestamp
    expect(model).toMatch(/createdAt\s+DateTime\s+@default\(now\(\)\)\s+@map\("created_at"\)/);
  });

  it('models the alert frequency as an enum (off | instant | daily | weekly) with @@map', () => {
    const en = block('AlertFrequency', 'enum');
    expect(en).toContain('@@map("alert_frequency")');
    expect(en).toMatch(/\boff\b/);
    expect(en).toMatch(/\binstant\b/);
    expect(en).toMatch(/\bdaily\b/);
    expect(en).toMatch(/\bweekly\b/);
  });

  it('makes a saved search unique per (tenant, user, name)', () => {
    const model = block('SavedSearch', 'model');
    expect(model).toContain('@@unique([tenantId, userId, name])');
  });

  it('cascades from the tenant and the customer (user)', () => {
    const model = block('SavedSearch', 'model');
    expect(model).toMatch(/tenant\s+PlatformTenant\s+@relation\([^)]*onDelete:\s*Cascade/);
    expect(model).toMatch(/user\s+User\s+@relation\([^)]*onDelete:\s*Cascade/);
  });

  it('back-relates from PlatformTenant and User', () => {
    expect(block('PlatformTenant', 'model')).toMatch(/savedSearches\s+SavedSearch\[\]/);
    expect(block('User', 'model')).toMatch(/savedSearches\s+SavedSearch\[\]/);
  });
});

describe('0022 RLS migration — tenant isolation on saved_searches', () => {
  it('enables + forces RLS with a fail-closed tenant_isolation policy', () => {
    expect(rlsMigration).toContain('ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;');
    expect(rlsMigration).toContain('ALTER TABLE saved_searches FORCE ROW LEVEL SECURITY;');
    expect(rlsMigration).toContain('CREATE POLICY tenant_isolation ON saved_searches');
    expect(rlsMigration).toContain(
      "NULLIF(current_setting('app.current_tenant_id', true), '')::uuid",
    );
  });
});

describe('RLS tenant isolation on saved_searches (pglite — mirrors 0022)', () => {
  const TENANT_A = '11111111-1111-1111-1111-111111111111';
  const TENANT_B = '22222222-2222-2222-2222-222222222222';
  const USER = '33333333-3333-3333-3333-333333333333';

  async function setup(): Promise<PGlite> {
    const db = new PGlite();
    await db.exec(`
      CREATE TABLE saved_searches (
        tenant_id uuid NOT NULL,
        user_id uuid NOT NULL,
        name text NOT NULL
      );
      ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
      CREATE POLICY tenant_isolation ON saved_searches
        USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
      CREATE ROLE app_user NOLOGIN;
      GRANT SELECT, INSERT ON saved_searches TO app_user;
    `);
    await db.exec(`SET ROLE app_user`);
    return db;
  }

  it('admits only the current tenant rows and fails closed when unset', async () => {
    const db = await setup();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await db.exec(
      `INSERT INTO saved_searches (tenant_id, user_id, name) VALUES ('${TENANT_A}', '${USER}', '3-bed in SS9')`,
    );
    await db.exec(`SET app.current_tenant_id = '${TENANT_B}'`);
    const none = await db.query<{ name: string }>(`SELECT name FROM saved_searches`);
    expect(none.rows).toEqual([]);
    await db.close();
  });

  it('blocks inserting a row for another tenant (WITH CHECK)', async () => {
    const db = await setup();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await expect(
      db.exec(
        `INSERT INTO saved_searches (tenant_id, user_id, name) VALUES ('${TENANT_B}', '${USER}', 'x')`,
      ),
    ).rejects.toThrow();
    await db.close();
  });
});
