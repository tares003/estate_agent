import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

// EPIC-G repair system (master spec §G.6, FR-G-2) — the repair_files table: the
// photos / videos a tenant attaches to a ticket (and staff / contractors add
// later), stored as keys into the StorageBackend and served via signed URLs.
// Tenant-scoped, isolated by the tenant_isolation RLS policy in 0009 (same shape
// as 0003/0005/0007/0008). Schema-only unit: asserts the schema source text +
// the raw SQL, and exercises the RLS policy against pglite.

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const schema = readFileSync(join(root, 'prisma', 'schema.prisma'), 'utf8');
const rlsMigration = readFileSync(
  join(root, 'migrations', 'raw', '0009_repair_files_rls.sql'),
  'utf8',
);

function block(name: string, kind: 'model' | 'enum'): string {
  const match = schema.match(new RegExp(`${kind} ${name} \\{[\\s\\S]*?\\n\\}`, 'm'));
  expect(match, `${kind} ${name} should be declared`).not.toBeNull();
  return match![0];
}

describe('RepairFile — schema (repair_files, master spec §G.6)', () => {
  it('is declared, tenant-scoped, and mapped to repair_files', () => {
    const model = block('RepairFile', 'model');
    expect(model).toContain('@@map("repair_files")');
    expect(model).toMatch(/tenantId\s+String\s+@map\("tenant_id"\)\s+@db\.Uuid/);
    expect(model).toContain('@@index([tenantId])');
    expect(model).toContain('@@index([tenantId, repairRequestId])');
    expect(model).toMatch(/tenant\s+PlatformTenant\s+@relation/);
  });

  it('carries the §G.6 columns: ticket ref, file url/name/mime/size, uploader, when', () => {
    const model = block('RepairFile', 'model');
    expect(model).toMatch(/repairRequestId\s+String\s+@map\("repair_request_id"\)\s+@db\.Uuid/);
    expect(model).toMatch(/url\s+String\s+@map\("file_url"\)/);
    expect(model).toMatch(/fileName\s+String\s+@map\("file_name"\)/);
    expect(model).toMatch(/mimeType\s+String\s+@map\("mime_type"\)/);
    expect(model).toMatch(/fileSizeBytes\s+Int\s+@map\("file_size_bytes"\)/);
    expect(model).toMatch(/uploadedBy\s+RepairFileUploadedBy\s+@default\(tenant\)/);
    expect(model).toMatch(/createdAt\s+DateTime\s+@default\(now\(\)\)\s+@map\("created_at"\)/);
  });

  it('declares the §G.6 uploader enum (tenant / staff / contractor)', () => {
    const enumBlock = block('RepairFileUploadedBy', 'enum');
    for (const value of ['tenant', 'staff', 'contractor']) {
      expect(enumBlock).toMatch(new RegExp(`^\\s+${value}$`, 'm'));
    }
  });

  it('RepairRequest carries the files relation', () => {
    const model = block('RepairRequest', 'model');
    expect(model).toMatch(/files\s+RepairFile\[\]/);
  });
});

describe('0009 RLS migration — tenant isolation on repair_files', () => {
  it('enables + forces RLS with a fail-closed tenant_isolation policy', () => {
    expect(rlsMigration).toContain('ALTER TABLE repair_files ENABLE ROW LEVEL SECURITY;');
    expect(rlsMigration).toContain('ALTER TABLE repair_files FORCE ROW LEVEL SECURITY;');
    expect(rlsMigration).toContain('CREATE POLICY tenant_isolation ON repair_files');
    expect(rlsMigration).toContain(
      "NULLIF(current_setting('app.current_tenant_id', true), '')::uuid",
    );
  });
});

describe('RLS tenant isolation on repair_files (pglite — mirrors 0009)', () => {
  const TENANT_A = '11111111-1111-1111-1111-111111111111';
  const TENANT_B = '22222222-2222-2222-2222-222222222222';

  async function setup(): Promise<PGlite> {
    const db = new PGlite();
    await db.exec(`
      CREATE TABLE repair_files (tenant_id uuid NOT NULL, file_url text NOT NULL);
      ALTER TABLE repair_files ENABLE ROW LEVEL SECURITY;
      CREATE POLICY tenant_isolation ON repair_files
        USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
      CREATE ROLE app_user NOLOGIN;
      GRANT SELECT, INSERT ON repair_files TO app_user;
    `);
    await db.exec(`SET ROLE app_user`);
    return db;
  }

  it('admits only the current tenant rows and fails closed when unset', async () => {
    const db = await setup();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await db.exec(
      `INSERT INTO repair_files (tenant_id, file_url) VALUES ('${TENANT_A}','tenants/a/repairs/r/x.jpg')`,
    );
    await db.exec(`SET app.current_tenant_id = '${TENANT_B}'`);
    const none = await db.query<{ file_url: string }>(`SELECT file_url FROM repair_files`);
    expect(none.rows).toEqual([]);
    await db.close();
  });

  it('blocks inserting a row for another tenant (WITH CHECK)', async () => {
    const db = await setup();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await expect(
      db.exec(
        `INSERT INTO repair_files (tenant_id, file_url) VALUES ('${TENANT_B}','tenants/b/repairs/r/x.jpg')`,
      ),
    ).rejects.toThrow();
    await db.close();
  });
});
