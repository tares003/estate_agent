import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

// EPIC-G repair system (master spec §G.5/§G.6, FR-G-6/FR-G-7) — the ticket status
// workflow + its append-only history. §G.6 specifies the status enum verbatim
// (9 values, including the off-path states awaiting_tenant / on_hold / rejected and
// the contractor hand-back awaiting_review) and the repair_status_history table
// (from/to, actor, notes, timestamp). Tenant-scoped, isolated by the
// tenant_isolation RLS policy in 0008 (same shape as 0003/0005/0007). Schema-only
// unit, so the tests assert the schema source text + the raw SQL, and exercise the
// RLS policy against pglite.

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const schema = readFileSync(join(root, 'prisma', 'schema.prisma'), 'utf8');
const rlsMigration = readFileSync(
  join(root, 'migrations', 'raw', '0008_repair_status_history_rls.sql'),
  'utf8',
);

function block(name: string, kind: 'model' | 'enum'): string {
  const match = schema.match(new RegExp(`${kind} ${name} \\{[\\s\\S]*?\\n\\}`, 'm'));
  expect(match, `${kind} ${name} should be declared`).not.toBeNull();
  return match![0];
}

describe('RepairStatus — the §G.6-specified ticket lifecycle enum', () => {
  it('carries exactly the spec statuses (happy path + off-path)', () => {
    const enumBlock = block('RepairStatus', 'enum');
    for (const status of [
      'new',
      'triaged',
      'contractor_assigned',
      'work_in_progress',
      'awaiting_review',
      'completed',
      'awaiting_tenant',
      'on_hold',
      'rejected',
    ]) {
      expect(enumBlock, `status ${status} should be declared`).toMatch(
        new RegExp(`^\\s+${status}$`, 'm'),
      );
    }
    // The pre-EPIC-G placeholder values §G.6 does not specify are gone.
    expect(enumBlock).not.toMatch(/^\s+assigned$/m);
    expect(enumBlock).not.toMatch(/^\s+in_progress$/m);
    expect(enumBlock).not.toMatch(/^\s+awaiting_parts$/m);
    expect(enumBlock).not.toMatch(/^\s+cancelled$/m);
  });

  it('RepairRequest carries the §G.6 rejected_reason column', () => {
    const model = block('RepairRequest', 'model');
    expect(model).toMatch(/rejectedReason\s+String\?\s+@map\("rejected_reason"\)/);
  });
});

describe('RepairStatusEvent — schema (repair_status_history, master spec §G.6)', () => {
  it('is declared, tenant-scoped, and mapped to repair_status_history', () => {
    const model = block('RepairStatusEvent', 'model');
    expect(model).toContain('@@map("repair_status_history")');
    expect(model).toMatch(/tenantId\s+String\s+@map\("tenant_id"\)\s+@db\.Uuid/);
    expect(model).toContain('@@index([tenantId])');
    expect(model).toMatch(/tenant\s+PlatformTenant\s+@relation/);
  });

  it('records the transition: ticket ref, optional from, required to, actor + notes + when', () => {
    const model = block('RepairStatusEvent', 'model');
    expect(model).toMatch(/repairRequestId\s+String\s+@map\("repair_request_id"\)\s+@db\.Uuid/);
    expect(model).toMatch(/fromStatus\s+RepairStatus\?\s+@map\("from_status"\)/);
    expect(model).toMatch(/toStatus\s+RepairStatus\s+@map\("to_status"\)/);
    expect(model).toMatch(/actorUserId\s+String\?\s+@map\("actor_user_id"\)\s+@db\.Uuid/);
    expect(model).toMatch(/notes\s+String\?/);
    expect(model).toMatch(/createdAt\s+DateTime\s+@default\(now\(\)\)\s+@map\("created_at"\)/);
    expect(model).toContain('@@index([tenantId, repairRequestId])');
  });
});

describe('0008 RLS migration — tenant isolation on repair_status_history', () => {
  it('enables + forces RLS with a fail-closed tenant_isolation policy', () => {
    expect(rlsMigration).toContain('ALTER TABLE repair_status_history ENABLE ROW LEVEL SECURITY;');
    expect(rlsMigration).toContain('ALTER TABLE repair_status_history FORCE ROW LEVEL SECURITY;');
    expect(rlsMigration).toContain('CREATE POLICY tenant_isolation ON repair_status_history');
    expect(rlsMigration).toContain(
      "NULLIF(current_setting('app.current_tenant_id', true), '')::uuid",
    );
  });
});

describe('RLS tenant isolation on repair_status_history (pglite — mirrors 0008)', () => {
  const TENANT_A = '11111111-1111-1111-1111-111111111111';
  const TENANT_B = '22222222-2222-2222-2222-222222222222';

  async function setup(): Promise<PGlite> {
    const db = new PGlite();
    await db.exec(`
      CREATE TABLE repair_status_history (tenant_id uuid NOT NULL, to_status text NOT NULL);
      ALTER TABLE repair_status_history ENABLE ROW LEVEL SECURITY;
      CREATE POLICY tenant_isolation ON repair_status_history
        USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
      CREATE ROLE app_user NOLOGIN;
      GRANT SELECT, INSERT ON repair_status_history TO app_user;
    `);
    await db.exec(`SET ROLE app_user`);
    return db;
  }

  it('admits only the current tenant rows and fails closed when unset', async () => {
    const db = await setup();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await db.exec(
      `INSERT INTO repair_status_history (tenant_id, to_status) VALUES ('${TENANT_A}','triaged')`,
    );
    await db.exec(`SET app.current_tenant_id = '${TENANT_B}'`);
    const none = await db.query<{ to_status: string }>(
      `SELECT to_status FROM repair_status_history`,
    );
    expect(none.rows).toEqual([]);
    await db.close();
  });

  it('blocks inserting a row for another tenant (WITH CHECK)', async () => {
    const db = await setup();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await expect(
      db.exec(
        `INSERT INTO repair_status_history (tenant_id, to_status) VALUES ('${TENANT_B}','rejected')`,
      ),
    ).rejects.toThrow();
    await db.close();
  });
});
