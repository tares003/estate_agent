import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

// EPIC-J (master spec §J "Area guide", ~line 1410-1411, FR-J-1) — the `area_guides`
// entity is a managed area-guide page: slug, name, introduction, hero image, the
// postcode prefixes the area covers (used to filter properties), geographic
// coordinates, meta title/description, status and standard timestamps. Its
// page-builder sections (`area_guide_sections`) use the same structure as page
// sections (master spec §J "Page section", ~line 1399): a reference to the parent,
// the section type, the typed JSON payload, sort order and a visibility flag.
// Both tables are tenant-scoped, isolated by the tenant_isolation RLS policy in
// 0020 (same shape as 0016/0018). Schema-only unit: asserts the schema source +
// the raw SQL, and exercises the RLS policy against pglite.

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const schema = readFileSync(join(root, 'prisma', 'schema.prisma'), 'utf8');
const rlsMigration = readFileSync(
  join(root, 'migrations', 'raw', '0020_area_guides_rls.sql'),
  'utf8',
);

function block(name: string, kind: 'model' | 'enum'): string {
  const match = schema.match(new RegExp(`${kind} ${name} \\{[\\s\\S]*?\\n\\}`, 'm'));
  expect(match, `${kind} ${name} should be declared`).not.toBeNull();
  return match![0];
}

describe('AreaGuide — schema (area_guides, master spec §J, FR-J-1)', () => {
  it('is declared, tenant-scoped, and mapped to area_guides', () => {
    const model = block('AreaGuide', 'model');
    expect(model).toContain('@@map("area_guides")');
    expect(model).toMatch(/tenantId\s+String\s+@map\("tenant_id"\)\s+@db\.Uuid/);
    expect(model).toContain('@@index([tenantId])');
  });

  it('captures the §J identity + content attributes', () => {
    const model = block('AreaGuide', 'model');
    expect(model).toMatch(/slug\s+String/);
    expect(model).toMatch(/name\s+String/);
    expect(model).toMatch(/introduction\s+String/);
    expect(model).toMatch(/heroImage\s+String\?\s+@map\("hero_image"\)/);
  });

  it('captures the covered postcode prefixes and geographic coordinates', () => {
    const model = block('AreaGuide', 'model');
    expect(model).toMatch(/postcodePrefixes\s+String\[\]\s+@map\("postcode_prefixes"\)/);
    expect(model).toMatch(/latitude\s+Float\?/);
    expect(model).toMatch(/longitude\s+Float\?/);
  });

  it('captures the SEO overrides, the status and standard timestamps', () => {
    const model = block('AreaGuide', 'model');
    expect(model).toMatch(/metaTitle\s+String\?\s+@map\("meta_title"\)/);
    expect(model).toMatch(/metaDescription\s+String\?\s+@map\("meta_description"\)/);
    expect(model).toMatch(/status\s+AreaGuideStatus\s+@default\(draft\)/);
    expect(model).toMatch(/createdAt\s+DateTime\s+@default\(now\(\)\)\s+@map\("created_at"\)/);
    expect(model).toMatch(/updatedAt\s+DateTime\s+@updatedAt\s+@map\("updated_at"\)/);
  });

  it('makes the slug unique per tenant and indexes (tenant, status)', () => {
    const model = block('AreaGuide', 'model');
    expect(model).toContain('@@unique([tenantId, slug])');
    expect(model).toContain('@@index([tenantId, status])');
  });

  it('declares the AreaGuideStatus enum (draft | published) mapped to area_guide_status', () => {
    const enumBlock = block('AreaGuideStatus', 'enum');
    expect(enumBlock).toMatch(/\bdraft\b/);
    expect(enumBlock).toMatch(/\bpublished\b/);
    expect(enumBlock).toContain('@@map("area_guide_status")');
  });

  it('cascades from the tenant and back-relates from PlatformTenant', () => {
    const model = block('AreaGuide', 'model');
    expect(model).toMatch(/tenant\s+PlatformTenant\s+@relation\([^)]*onDelete:\s*Cascade/);
    expect(block('PlatformTenant', 'model')).toMatch(/areaGuides\s+AreaGuide\[\]/);
  });

  it('owns its page-builder sections', () => {
    const model = block('AreaGuide', 'model');
    expect(model).toMatch(/sections\s+AreaGuideSection\[\]/);
  });
});

describe('AreaGuideSection — schema (area_guide_sections, master spec §J page-section shape)', () => {
  it('is declared, tenant-scoped, and mapped to area_guide_sections', () => {
    const model = block('AreaGuideSection', 'model');
    expect(model).toContain('@@map("area_guide_sections")');
    expect(model).toMatch(/tenantId\s+String\s+@map\("tenant_id"\)\s+@db\.Uuid/);
    expect(model).toContain('@@index([tenantId])');
  });

  it('mirrors the page-section structure: type, typed JSON data, sort order, visibility', () => {
    const model = block('AreaGuideSection', 'model');
    expect(model).toMatch(/type\s+String/);
    expect(model).toMatch(/data\s+Json/);
    expect(model).toMatch(/sortOrder\s+Int\s+@default\(0\)\s+@map\("sort_order"\)/);
    expect(model).toMatch(/isVisible\s+Boolean\s+@default\(true\)\s+@map\("is_visible"\)/);
  });

  it('references its parent area guide and cascades from both tenant and guide', () => {
    const model = block('AreaGuideSection', 'model');
    expect(model).toMatch(/areaGuideId\s+String\s+@map\("area_guide_id"\)\s+@db\.Uuid/);
    expect(model).toMatch(/tenant\s+PlatformTenant\s+@relation\([^)]*onDelete:\s*Cascade/);
    expect(model).toMatch(/areaGuide\s+AreaGuide\s+@relation\([^)]*onDelete:\s*Cascade/);
    expect(model).toContain('@@index([tenantId, areaGuideId])');
  });

  it('back-relates from PlatformTenant', () => {
    expect(block('PlatformTenant', 'model')).toMatch(/areaGuideSections\s+AreaGuideSection\[\]/);
  });
});

describe('0020 RLS migration — tenant isolation on area_guides + area_guide_sections', () => {
  it('enables + forces RLS with a fail-closed tenant_isolation policy on area_guides', () => {
    expect(rlsMigration).toContain('ALTER TABLE area_guides ENABLE ROW LEVEL SECURITY;');
    expect(rlsMigration).toContain('ALTER TABLE area_guides FORCE ROW LEVEL SECURITY;');
    expect(rlsMigration).toContain('CREATE POLICY tenant_isolation ON area_guides');
  });

  it('enables + forces RLS with a fail-closed tenant_isolation policy on area_guide_sections', () => {
    expect(rlsMigration).toContain('ALTER TABLE area_guide_sections ENABLE ROW LEVEL SECURITY;');
    expect(rlsMigration).toContain('ALTER TABLE area_guide_sections FORCE ROW LEVEL SECURITY;');
    expect(rlsMigration).toContain('CREATE POLICY tenant_isolation ON area_guide_sections');
  });

  it('uses the fail-closed GUC predicate', () => {
    expect(rlsMigration).toContain(
      "NULLIF(current_setting('app.current_tenant_id', true), '')::uuid",
    );
  });
});

describe('RLS tenant isolation on area_guides (pglite — mirrors 0020)', () => {
  const TENANT_A = '11111111-1111-1111-1111-111111111111';
  const TENANT_B = '22222222-2222-2222-2222-222222222222';

  async function setup(): Promise<PGlite> {
    const db = new PGlite();
    await db.exec(`
      CREATE TABLE area_guides (
        tenant_id uuid NOT NULL,
        slug text NOT NULL,
        name text NOT NULL
      );
      ALTER TABLE area_guides ENABLE ROW LEVEL SECURITY;
      CREATE POLICY tenant_isolation ON area_guides
        USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
      CREATE ROLE app_user NOLOGIN;
      GRANT SELECT, INSERT ON area_guides TO app_user;
    `);
    await db.exec(`SET ROLE app_user`);
    return db;
  }

  it('admits only the current tenant rows and fails closed when unset', async () => {
    const db = await setup();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await db.exec(
      `INSERT INTO area_guides (tenant_id, slug, name) VALUES ('${TENANT_A}', 'clifton', 'Clifton')`,
    );
    await db.exec(`SET app.current_tenant_id = '${TENANT_B}'`);
    const none = await db.query<{ slug: string }>(`SELECT slug FROM area_guides`);
    expect(none.rows).toEqual([]);
    await db.close();
  });

  it('blocks inserting a row for another tenant (WITH CHECK)', async () => {
    const db = await setup();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await expect(
      db.exec(
        `INSERT INTO area_guides (tenant_id, slug, name) VALUES ('${TENANT_B}', 'x', 'X')`,
      ),
    ).rejects.toThrow();
    await db.close();
  });
});

describe('RLS tenant isolation on area_guide_sections (pglite — mirrors 0020)', () => {
  const TENANT_A = '11111111-1111-1111-1111-111111111111';
  const TENANT_B = '22222222-2222-2222-2222-222222222222';
  const GUIDE = '33333333-3333-3333-3333-333333333333';

  async function setup(): Promise<PGlite> {
    const db = new PGlite();
    await db.exec(`
      CREATE TABLE area_guide_sections (
        tenant_id uuid NOT NULL,
        area_guide_id uuid NOT NULL,
        type text NOT NULL
      );
      ALTER TABLE area_guide_sections ENABLE ROW LEVEL SECURITY;
      CREATE POLICY tenant_isolation ON area_guide_sections
        USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
      CREATE ROLE app_user NOLOGIN;
      GRANT SELECT, INSERT ON area_guide_sections TO app_user;
    `);
    await db.exec(`SET ROLE app_user`);
    return db;
  }

  it('admits only the current tenant rows and fails closed when unset', async () => {
    const db = await setup();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await db.exec(
      `INSERT INTO area_guide_sections (tenant_id, area_guide_id, type) VALUES ('${TENANT_A}', '${GUIDE}', 'hero')`,
    );
    await db.exec(`SET app.current_tenant_id = '${TENANT_B}'`);
    const none = await db.query<{ type: string }>(`SELECT type FROM area_guide_sections`);
    expect(none.rows).toEqual([]);
    await db.close();
  });

  it('blocks inserting a row for another tenant (WITH CHECK)', async () => {
    const db = await setup();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await expect(
      db.exec(
        `INSERT INTO area_guide_sections (tenant_id, area_guide_id, type) VALUES ('${TENANT_B}', '${GUIDE}', 'hero')`,
      ),
    ).rejects.toThrow();
    await db.close();
  });
});
