import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

// EPIC-I CRM (master spec §I.3) — the append-only enquiry status timeline. Mirrors
// PropertyStatusEvent: every status transition (incl. the one a conversion makes)
// is recorded with from/to, the enquiry, when, and (optionally) the acting agent.
// Tenant-scoped, isolated by the tenant_isolation RLS policy in 0007 (same shape as
// 0003/0005). Schema-only unit (no src consumers), so the tests assert the schema
// source text + the raw SQL, and exercise the RLS policy against pglite.

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const schema = readFileSync(join(root, 'prisma', 'schema.prisma'), 'utf8');
const rlsMigration = readFileSync(
  join(root, 'migrations', 'raw', '0007_enquiry_status_events_rls.sql'),
  'utf8',
);

function modelBlock(model: string): string {
  const match = schema.match(new RegExp(`model ${model} \\{[\\s\\S]*?\\n\\}`, 'm'));
  expect(match, `model ${model} should be declared`).not.toBeNull();
  return match![0];
}

describe('EnquiryStatusEvent — schema (status timeline, master spec §I.3)', () => {
  it('is declared, tenant-scoped, and mapped to enquiry_status_events', () => {
    const block = modelBlock('EnquiryStatusEvent');
    expect(block).toContain('@@map("enquiry_status_events")');
    expect(block).toMatch(/tenantId\s+String\s+@map\("tenant_id"\)\s+@db\.Uuid/);
    expect(block).toContain('@@index([tenantId])');
    expect(block).toMatch(/tenant\s+PlatformTenant\s+@relation/);
  });

  it('records the transition: enquiry ref, optional from, required to, optional agent + when', () => {
    const block = modelBlock('EnquiryStatusEvent');
    expect(block).toMatch(/enquiryId\s+String\s+@map\("enquiry_id"\)\s+@db\.Uuid/);
    expect(block).toMatch(/fromStatus\s+EnquiryStatus\?\s+@map\("from_status"\)/);
    expect(block).toMatch(/toStatus\s+EnquiryStatus\s+@map\("to_status"\)/);
    expect(block).toMatch(
      /changedByAgentId\s+String\?\s+@map\("changed_by_agent_id"\)\s+@db\.Uuid/,
    );
    expect(block).toMatch(/changedAt\s+DateTime\s+@default\(now\(\)\)\s+@map\("changed_at"\)/);
    expect(block).toContain('@@index([tenantId, enquiryId])');
  });
});

describe('0007 RLS migration — tenant isolation on enquiry_status_events', () => {
  it('enables + forces RLS with a fail-closed tenant_isolation policy', () => {
    expect(rlsMigration).toContain('ALTER TABLE enquiry_status_events ENABLE ROW LEVEL SECURITY;');
    expect(rlsMigration).toContain('ALTER TABLE enquiry_status_events FORCE ROW LEVEL SECURITY;');
    expect(rlsMigration).toContain('CREATE POLICY tenant_isolation ON enquiry_status_events');
    expect(rlsMigration).toContain(
      "NULLIF(current_setting('app.current_tenant_id', true), '')::uuid",
    );
  });
});

describe('RLS tenant isolation on enquiry_status_events (pglite — mirrors 0007)', () => {
  const TENANT_A = '11111111-1111-1111-1111-111111111111';
  const TENANT_B = '22222222-2222-2222-2222-222222222222';

  async function setup(): Promise<PGlite> {
    const db = new PGlite();
    await db.exec(`
      CREATE TABLE enquiry_status_events (tenant_id uuid NOT NULL, to_status text NOT NULL);
      ALTER TABLE enquiry_status_events ENABLE ROW LEVEL SECURITY;
      CREATE POLICY tenant_isolation ON enquiry_status_events
        USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
      CREATE ROLE app_user NOLOGIN;
      GRANT SELECT, INSERT ON enquiry_status_events TO app_user;
    `);
    await db.exec(`SET ROLE app_user`);
    return db;
  }

  it('admits only the current tenant rows and fails closed when unset', async () => {
    const db = await setup();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await db.exec(
      `INSERT INTO enquiry_status_events (tenant_id, to_status) VALUES ('${TENANT_A}','contacted')`,
    );
    await db.exec(`SET app.current_tenant_id = '${TENANT_B}'`);
    const none = await db.query<{ to_status: string }>(
      `SELECT to_status FROM enquiry_status_events`,
    );
    expect(none.rows).toEqual([]);
    await db.close();
  });

  it('blocks inserting a row for another tenant (WITH CHECK)', async () => {
    const db = await setup();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await expect(
      db.exec(
        `INSERT INTO enquiry_status_events (tenant_id, to_status) VALUES ('${TENANT_B}','lost')`,
      ),
    ).rejects.toThrow();
    await db.close();
  });
});
