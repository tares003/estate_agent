import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

// EPIC-AC feedback collection (master spec §B.36 / §J, FR-AC-4/5). The `feedback`
// entity captures structured feedback at journey moments (after a viewing / sale /
// tenancy / repair): a rating, an optional comment, a publish-as-testimonial flag,
// and the moderation lifecycle. Tenant-scoped, isolated by the tenant_isolation RLS
// policy in 0013 (same shape as 0011). Schema-only unit: asserts the schema source
// + the raw SQL, and exercises the RLS policy against pglite.

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const schema = readFileSync(join(root, 'prisma', 'schema.prisma'), 'utf8');
const rlsMigration = readFileSync(join(root, 'migrations', 'raw', '0013_feedback_rls.sql'), 'utf8');

function block(name: string, kind: 'model' | 'enum'): string {
  const match = schema.match(new RegExp(`${kind} ${name} \\{[\\s\\S]*?\\n\\}`, 'm'));
  expect(match, `${kind} ${name} should be declared`).not.toBeNull();
  return match![0];
}

describe('Feedback — schema (feedback, master spec §B.36, FR-AC-4)', () => {
  it('is declared, tenant-scoped, and mapped to feedback', () => {
    const model = block('Feedback', 'model');
    expect(model).toContain('@@map("feedback")');
    expect(model).toMatch(/tenantId\s+String\s+@map\("tenant_id"\)\s+@db\.Uuid/);
    expect(model).toContain('@@index([tenantId])');
    expect(model).toMatch(/tenant\s+PlatformTenant\s+@relation/);
  });

  it('carries the FR-AC-4 capture columns', () => {
    const model = block('Feedback', 'model');
    expect(model).toMatch(/triggerType\s+FeedbackTrigger/);
    expect(model).toMatch(/triggerEntityId\s+String\?\s+@map\("trigger_entity_id"\)\s+@db\.Uuid/);
    expect(model).toMatch(/respondentRef\s+String\?\s+@map\("respondent_ref"\)/);
    expect(model).toMatch(/rating\s+Int/);
    expect(model).toMatch(/comment\s+String\?/);
    expect(model).toMatch(
      /publishAsTestimonial\s+Boolean\s+@default\(false\)\s+@map\("publish_as_testimonial"\)/,
    );
  });

  it('carries the FR-AC-5/10 moderation + alert columns', () => {
    const model = block('Feedback', 'model');
    expect(model).toMatch(/status\s+FeedbackStatus\s+@default\(pending\)/);
    expect(model).toMatch(/rejectedReason\s+String\?\s+@map\("rejected_reason"\)/);
    expect(model).toMatch(/needsResponse\s+Boolean\s+@default\(false\)\s+@map\("needs_response"\)/);
  });

  it('FeedbackStatus is the moderation lifecycle (pending → published / rejected)', () => {
    const enumBlock = block('FeedbackStatus', 'enum');
    for (const value of ['pending', 'published', 'rejected']) {
      expect(enumBlock).toContain(value);
    }
    expect(enumBlock).toContain('@@map("feedback_status")');
  });

  it('FeedbackTrigger enumerates the configured journey moments (FR-AC-1)', () => {
    const enumBlock = block('FeedbackTrigger', 'enum');
    for (const value of [
      'viewing_attended',
      'sale_completed',
      'tenancy_started',
      'tenancy_ended',
      'repair_completed',
    ]) {
      expect(enumBlock).toContain(value);
    }
    expect(enumBlock).toContain('@@map("feedback_trigger")');
  });

  it('PlatformTenant back-relates to feedback', () => {
    expect(block('PlatformTenant', 'model')).toMatch(/feedback\s+Feedback\[\]/);
  });
});

describe('0013 RLS migration — tenant isolation on feedback', () => {
  it('enables + forces RLS with a fail-closed tenant_isolation policy', () => {
    expect(rlsMigration).toContain('ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;');
    expect(rlsMigration).toContain('ALTER TABLE feedback FORCE ROW LEVEL SECURITY;');
    expect(rlsMigration).toContain('CREATE POLICY tenant_isolation ON feedback');
    expect(rlsMigration).toContain(
      "NULLIF(current_setting('app.current_tenant_id', true), '')::uuid",
    );
  });
});

describe('RLS tenant isolation on feedback (pglite — mirrors 0013)', () => {
  const TENANT_A = '11111111-1111-1111-1111-111111111111';
  const TENANT_B = '22222222-2222-2222-2222-222222222222';

  async function setup(): Promise<PGlite> {
    const db = new PGlite();
    await db.exec(`
      CREATE TABLE feedback (tenant_id uuid NOT NULL, rating int NOT NULL);
      ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
      CREATE POLICY tenant_isolation ON feedback
        USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
      CREATE ROLE app_user NOLOGIN;
      GRANT SELECT, INSERT ON feedback TO app_user;
    `);
    await db.exec(`SET ROLE app_user`);
    return db;
  }

  it('admits only the current tenant rows and fails closed when unset', async () => {
    const db = await setup();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await db.exec(`INSERT INTO feedback (tenant_id, rating) VALUES ('${TENANT_A}', 5)`);
    await db.exec(`SET app.current_tenant_id = '${TENANT_B}'`);
    const none = await db.query<{ rating: number }>(`SELECT rating FROM feedback`);
    expect(none.rows).toEqual([]);
    await db.close();
  });

  it('blocks inserting a row for another tenant (WITH CHECK)', async () => {
    const db = await setup();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await expect(
      db.exec(`INSERT INTO feedback (tenant_id, rating) VALUES ('${TENANT_B}', 1)`),
    ).rejects.toThrow();
    await db.close();
  });
});
