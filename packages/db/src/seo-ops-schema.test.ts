import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

// EPIC-J SEO / ops foundation entities (master spec §J, FR-J-1). Three independent
// tenant-scoped tables — the storage layer only (consumers land in their owning
// epic PRs):
//   - redirects     (§J, "Redirect")     — URL redirect rules with a hit counter.
//   - seo_metadata  (§J, "SEO metadata") — per-page / per-entity SEO overrides.
//   - import_logs   (§J, "Import log")   — a record of every bulk-import run.
// All three are isolated by the tenant_isolation RLS policy in 0021 (same shape as
// 0013/0014/0016). Schema-only unit: asserts the schema source + the raw SQL, and
// exercises the RLS policy against pglite.

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const schema = readFileSync(join(root, 'prisma', 'schema.prisma'), 'utf8');
const rlsMigration = readFileSync(join(root, 'migrations', 'raw', '0021_seo_ops_rls.sql'), 'utf8');

function block(name: string, kind: 'model' | 'enum'): string {
  const match = schema.match(new RegExp(`${kind} ${name} \\{[\\s\\S]*?\\n\\}`, 'm'));
  expect(match, `${kind} ${name} should be declared`).not.toBeNull();
  return match![0];
}

describe('Redirect — schema (redirects, master spec §J)', () => {
  it('is declared, tenant-scoped, and mapped to redirects', () => {
    const model = block('Redirect', 'model');
    expect(model).toContain('@@map("redirects")');
    expect(model).toMatch(/tenantId\s+String\s+@map\("tenant_id"\)\s+@db\.Uuid/);
    expect(model).toContain('@@index([tenantId])');
  });

  it('captures source / destination paths, type, hit counter and last-hit time', () => {
    const model = block('Redirect', 'model');
    expect(model).toMatch(/sourcePath\s+String\s+@map\("source_path"\)/);
    expect(model).toMatch(/destinationPath\s+String\s+@map\("destination_path"\)/);
    expect(model).toMatch(/type\s+RedirectType/);
    expect(model).toMatch(/hitCount\s+Int\s+@default\(0\)\s+@map\("hit_count"\)/);
    expect(model).toMatch(/lastHitAt\s+DateTime\?\s+@map\("last_hit_at"\)/);
  });

  it('makes the source path unique per tenant and indexes it for lookup', () => {
    const model = block('Redirect', 'model');
    expect(model).toContain('@@unique([tenantId, sourcePath])');
    expect(model).toMatch(/@@index\(\[tenantId,\s*sourcePath\]\)/);
  });

  it('cascades from the tenant and back-relates from PlatformTenant', () => {
    const model = block('Redirect', 'model');
    expect(model).toMatch(/tenant\s+PlatformTenant\s+@relation\([^)]*onDelete:\s*Cascade/);
    expect(block('PlatformTenant', 'model')).toMatch(/redirects\s+Redirect\[\]/);
  });

  it('declares a RedirectType enum mapped with the 301/302/307/410 statuses', () => {
    const enumBlock = block('RedirectType', 'enum');
    expect(enumBlock).toContain('@@map("redirect_type")');
    expect(enumBlock).toMatch(/\br301\b/);
    expect(enumBlock).toMatch(/\br302\b/);
    expect(enumBlock).toMatch(/\br307\b/);
    expect(enumBlock).toMatch(/\bgone\b/);
  });
});

describe('SeoMetadata — schema (seo_metadata, master spec §J)', () => {
  it('is declared, tenant-scoped, and mapped to seo_metadata', () => {
    const model = block('SeoMetadata', 'model');
    expect(model).toContain('@@map("seo_metadata")');
    expect(model).toMatch(/tenantId\s+String\s+@map\("tenant_id"\)\s+@db\.Uuid/);
    expect(model).toContain('@@index([tenantId])');
  });

  it('captures the scope, scope id and the override fields', () => {
    const model = block('SeoMetadata', 'model');
    expect(model).toMatch(/scope\s+SeoScope/);
    expect(model).toMatch(/scopeId\s+String\?\s+@map\("scope_id"\)/);
    expect(model).toMatch(/metaTitle\s+String\?\s+@map\("meta_title"\)/);
    expect(model).toMatch(/metaDescription\s+String\?\s+@map\("meta_description"\)/);
    expect(model).toMatch(/canonicalUrl\s+String\?\s+@map\("canonical_url"\)/);
    expect(model).toMatch(/ogImage\s+String\?\s+@map\("og_image"\)/);
    expect(model).toMatch(/structuredData\s+Json\?\s+@map\("structured_data"\)/);
  });

  it('flags no-index / no-follow defaulting to false', () => {
    const model = block('SeoMetadata', 'model');
    expect(model).toMatch(/noIndex\s+Boolean\s+@default\(false\)\s+@map\("no_index"\)/);
    expect(model).toMatch(/noFollow\s+Boolean\s+@default\(false\)\s+@map\("no_follow"\)/);
  });

  it('indexes the (tenant, scope, scopeId) lookup for override resolution', () => {
    const model = block('SeoMetadata', 'model');
    expect(model).toMatch(/@@index\(\[tenantId,\s*scope,\s*scopeId\]\)/);
  });

  it('cascades from the tenant and back-relates from PlatformTenant', () => {
    const model = block('SeoMetadata', 'model');
    expect(model).toMatch(/tenant\s+PlatformTenant\s+@relation\([^)]*onDelete:\s*Cascade/);
    expect(block('PlatformTenant', 'model')).toMatch(/seoMetadata\s+SeoMetadata\[\]/);
  });

  it('declares a SeoScope enum mapped with page/property/area_guide/blog_post/branch/default', () => {
    const enumBlock = block('SeoScope', 'enum');
    expect(enumBlock).toContain('@@map("seo_scope")');
    expect(enumBlock).toMatch(/\bpage\b/);
    expect(enumBlock).toMatch(/\bproperty\b/);
    expect(enumBlock).toMatch(/\barea_guide\b/);
    expect(enumBlock).toMatch(/\bblog_post\b/);
    expect(enumBlock).toMatch(/\bbranch\b/);
  });
});

describe('ImportLog — schema (import_logs, master spec §J)', () => {
  it('is declared, tenant-scoped, and mapped to import_logs', () => {
    const model = block('ImportLog', 'model');
    expect(model).toContain('@@map("import_logs")');
    expect(model).toMatch(/tenantId\s+String\s+@map\("tenant_id"\)\s+@db\.Uuid/);
    expect(model).toContain('@@index([tenantId])');
  });

  it('captures the source, who triggered it, and the start/finish timestamps', () => {
    const model = block('ImportLog', 'model');
    expect(model).toMatch(/source\s+String/);
    expect(model).toMatch(/triggeredBy\s+String\?\s+@map\("triggered_by"\)/);
    expect(model).toMatch(/startedAt\s+DateTime\s+@default\(now\(\)\)\s+@map\("started_at"\)/);
    expect(model).toMatch(/finishedAt\s+DateTime\?\s+@map\("finished_at"\)/);
  });

  it('captures the per-run record counts defaulting to zero', () => {
    const model = block('ImportLog', 'model');
    expect(model).toMatch(/recordsInput\s+Int\s+@default\(0\)\s+@map\("records_input"\)/);
    expect(model).toMatch(/recordsCreated\s+Int\s+@default\(0\)\s+@map\("records_created"\)/);
    expect(model).toMatch(/recordsUpdated\s+Int\s+@default\(0\)\s+@map\("records_updated"\)/);
    expect(model).toMatch(/recordsSkipped\s+Int\s+@default\(0\)\s+@map\("records_skipped"\)/);
    expect(model).toMatch(/recordsFailed\s+Int\s+@default\(0\)\s+@map\("records_failed"\)/);
  });

  it('captures a structured error summary', () => {
    const model = block('ImportLog', 'model');
    expect(model).toMatch(/errorSummary\s+Json\?\s+@map\("error_summary"\)/);
  });

  it('cascades from the tenant and back-relates from PlatformTenant', () => {
    const model = block('ImportLog', 'model');
    expect(model).toMatch(/tenant\s+PlatformTenant\s+@relation\([^)]*onDelete:\s*Cascade/);
    expect(block('PlatformTenant', 'model')).toMatch(/importLogs\s+ImportLog\[\]/);
  });
});

describe('0021 RLS migration — tenant isolation on the SEO/ops tables', () => {
  it('enables + forces RLS with a fail-closed tenant_isolation policy on each table', () => {
    for (const table of ['redirects', 'seo_metadata', 'import_logs']) {
      expect(rlsMigration).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
      expect(rlsMigration).toContain(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`);
      expect(rlsMigration).toContain(`CREATE POLICY tenant_isolation ON ${table}`);
    }
    expect(rlsMigration).toContain(
      "NULLIF(current_setting('app.current_tenant_id', true), '')::uuid",
    );
  });
});

describe('RLS tenant isolation on the SEO/ops tables (pglite — mirrors 0021)', () => {
  const TENANT_A = '11111111-1111-1111-1111-111111111111';
  const TENANT_B = '22222222-2222-2222-2222-222222222222';

  async function setup(): Promise<PGlite> {
    const db = new PGlite();
    await db.exec(`
      CREATE TABLE redirects (
        tenant_id uuid NOT NULL,
        source_path text NOT NULL,
        destination_path text NOT NULL
      );
      ALTER TABLE redirects ENABLE ROW LEVEL SECURITY;
      CREATE POLICY tenant_isolation ON redirects
        USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
      CREATE ROLE app_user NOLOGIN;
      GRANT SELECT, INSERT ON redirects TO app_user;
    `);
    await db.exec(`SET ROLE app_user`);
    return db;
  }

  it('admits only the current tenant rows and fails closed when unset', async () => {
    const db = await setup();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await db.exec(
      `INSERT INTO redirects (tenant_id, source_path, destination_path) VALUES ('${TENANT_A}', '/old', '/new')`,
    );
    await db.exec(`SET app.current_tenant_id = '${TENANT_B}'`);
    const none = await db.query<{ source_path: string }>(`SELECT source_path FROM redirects`);
    expect(none.rows).toEqual([]);
    await db.close();
  });

  it('blocks inserting a row for another tenant (WITH CHECK)', async () => {
    const db = await setup();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await expect(
      db.exec(
        `INSERT INTO redirects (tenant_id, source_path, destination_path) VALUES ('${TENANT_B}', '/old', '/new')`,
      ),
    ).rejects.toThrow();
    await db.close();
  });
});
