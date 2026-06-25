import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

// EPIC-J blog entities (master spec §J — "Blog post" / "Blog category" /
// "Blog post tag" / "Blog author"; §H admin "Blog" tab). Four tenant-scoped
// tables back the knowledge hub:
//   - blog_authors      — name, slug, bio, avatar
//   - blog_categories   — name, slug, description, sort order
//   - blog_post_tags    — the tag entity (name, slug) in a m-n with posts
//   - blog_posts        — the article (slug/title/body/excerpt/hero/SEO/status/
//                         schedule) with category (m-1), author (m-1), tags (m-n)
// Each is isolated by the tenant_isolation RLS policy in 0019. This is a
// PHASE-B FOUNDATION (storage-only) slice — no consumers. The test asserts the
// schema source shape + the raw SQL, and exercises the RLS policy against pglite.

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const schema = readFileSync(join(root, 'prisma', 'schema.prisma'), 'utf8');
const rlsMigration = readFileSync(join(root, 'migrations', 'raw', '0019_blog_rls.sql'), 'utf8');

function block(name: string, kind: 'model' | 'enum'): string {
  const match = schema.match(new RegExp(`${kind} ${name} \\{[\\s\\S]*?\\n\\}`, 'm'));
  expect(match, `${kind} ${name} should be declared`).not.toBeNull();
  return match![0];
}

describe('BlogAuthor — schema (blog_authors, master spec §J)', () => {
  it('is declared, tenant-scoped, and mapped to blog_authors', () => {
    const model = block('BlogAuthor', 'model');
    expect(model).toContain('@@map("blog_authors")');
    expect(model).toMatch(/tenantId\s+String\s+@map\("tenant_id"\)\s+@db\.Uuid/);
    expect(model).toContain('@@index([tenantId])');
  });

  it('captures name, a per-tenant-unique slug, and nullable bio + avatar', () => {
    const model = block('BlogAuthor', 'model');
    expect(model).toMatch(/name\s+String/);
    expect(model).toMatch(/slug\s+String/);
    expect(model).toMatch(/bio\s+String\?/);
    expect(model).toMatch(/avatarUrl\s+String\?\s+@map\("avatar_url"\)/);
    expect(model).toContain('@@unique([tenantId, slug])');
  });

  it('cascades from the tenant and back-relates its posts', () => {
    const model = block('BlogAuthor', 'model');
    expect(model).toMatch(/tenant\s+PlatformTenant\s+@relation\([^)]*onDelete:\s*Cascade/);
    expect(model).toMatch(/posts\s+BlogPost\[\]/);
  });
});

describe('BlogCategory — schema (blog_categories, master spec §J)', () => {
  it('is declared, tenant-scoped, and mapped to blog_categories', () => {
    const model = block('BlogCategory', 'model');
    expect(model).toContain('@@map("blog_categories")');
    expect(model).toMatch(/tenantId\s+String\s+@map\("tenant_id"\)\s+@db\.Uuid/);
    expect(model).toContain('@@index([tenantId])');
  });

  it('captures name, slug, nullable description and a sort order', () => {
    const model = block('BlogCategory', 'model');
    expect(model).toMatch(/name\s+String/);
    expect(model).toMatch(/slug\s+String/);
    expect(model).toMatch(/description\s+String\?/);
    expect(model).toMatch(/sortOrder\s+Int\s+@default\(0\)\s+@map\("sort_order"\)/);
    expect(model).toContain('@@unique([tenantId, slug])');
  });

  it('cascades from the tenant and back-relates its posts', () => {
    const model = block('BlogCategory', 'model');
    expect(model).toMatch(/tenant\s+PlatformTenant\s+@relation\([^)]*onDelete:\s*Cascade/);
    expect(model).toMatch(/posts\s+BlogPost\[\]/);
  });
});

describe('BlogPostTag — schema (blog_post_tags, master spec §J)', () => {
  it('is declared, tenant-scoped, and mapped to blog_post_tags', () => {
    const model = block('BlogPostTag', 'model');
    expect(model).toContain('@@map("blog_post_tags")');
    expect(model).toMatch(/tenantId\s+String\s+@map\("tenant_id"\)\s+@db\.Uuid/);
    expect(model).toContain('@@index([tenantId])');
  });

  it('captures name + a per-tenant-unique slug and joins posts m-n', () => {
    const model = block('BlogPostTag', 'model');
    expect(model).toMatch(/name\s+String/);
    expect(model).toMatch(/slug\s+String/);
    expect(model).toContain('@@unique([tenantId, slug])');
    expect(model).toMatch(/posts\s+BlogPost\[\]/);
  });

  it('cascades from the tenant', () => {
    const model = block('BlogPostTag', 'model');
    expect(model).toMatch(/tenant\s+PlatformTenant\s+@relation\([^)]*onDelete:\s*Cascade/);
  });
});

describe('BlogPost — schema (blog_posts, master spec §J)', () => {
  it('is declared, tenant-scoped, and mapped to blog_posts', () => {
    const model = block('BlogPost', 'model');
    expect(model).toContain('@@map("blog_posts")');
    expect(model).toMatch(/tenantId\s+String\s+@map\("tenant_id"\)\s+@db\.Uuid/);
    expect(model).toContain('@@index([tenantId])');
  });

  it('captures title, a per-tenant-unique slug, and a block-based Json body', () => {
    const model = block('BlogPost', 'model');
    expect(model).toMatch(/title\s+String/);
    expect(model).toMatch(/slug\s+String/);
    expect(model).toMatch(/body\s+Json/);
    // §J — a pre-rendered HTML cache of the source body (nullable until published).
    expect(model).toMatch(/renderedHtmlCache\s+String\?\s+@map\("rendered_html_cache"\)/);
    expect(model).toContain('@@unique([tenantId, slug])');
  });

  it('captures nullable excerpt, hero image and SEO meta fields', () => {
    const model = block('BlogPost', 'model');
    expect(model).toMatch(/excerpt\s+String\?/);
    expect(model).toMatch(/heroImageUrl\s+String\?\s+@map\("hero_image_url"\)/);
    expect(model).toMatch(/metaTitle\s+String\?\s+@map\("meta_title"\)/);
    expect(model).toMatch(/metaDescription\s+String\?\s+@map\("meta_description"\)/);
  });

  it('carries a publication status enum and the schedule timestamps', () => {
    const model = block('BlogPost', 'model');
    expect(model).toMatch(/status\s+BlogPostStatus\s+@default\(draft\)/);
    expect(model).toMatch(/publishedAt\s+DateTime\?\s+@map\("published_at"\)/);
    expect(model).toMatch(/scheduledFor\s+DateTime\?\s+@map\("scheduled_for"\)/);
  });

  it('relates category (m-1, nullable), author (m-1, nullable) and tags (m-n)', () => {
    const model = block('BlogPost', 'model');
    expect(model).toMatch(/categoryId\s+String\?\s+@map\("category_id"\)\s+@db\.Uuid/);
    expect(model).toMatch(/authorId\s+String\?\s+@map\("author_id"\)\s+@db\.Uuid/);
    expect(model).toMatch(/category\s+BlogCategory\?\s+@relation\([^)]*onDelete:\s*SetNull/);
    expect(model).toMatch(/author\s+BlogAuthor\?\s+@relation\([^)]*onDelete:\s*SetNull/);
    expect(model).toMatch(/tags\s+BlogPostTag\[\]/);
  });

  it('cascades from the tenant and indexes the status lookup', () => {
    const model = block('BlogPost', 'model');
    expect(model).toMatch(/tenant\s+PlatformTenant\s+@relation\([^)]*onDelete:\s*Cascade/);
    expect(model).toContain('@@index([tenantId, status])');
  });
});

describe('BlogPostStatus — enum (blog_post_status, master spec §J)', () => {
  it('declares the draft / scheduled / published lifecycle', () => {
    const e = block('BlogPostStatus', 'enum');
    expect(e).toContain('@@map("blog_post_status")');
    expect(e).toMatch(/\bdraft\b/);
    expect(e).toMatch(/\bscheduled\b/);
    expect(e).toMatch(/\bpublished\b/);
  });
});

describe('PlatformTenant — back-relations for the blog entities', () => {
  it('back-relates each blog model', () => {
    const model = block('PlatformTenant', 'model');
    expect(model).toMatch(/blogAuthors\s+BlogAuthor\[\]/);
    expect(model).toMatch(/blogCategories\s+BlogCategory\[\]/);
    expect(model).toMatch(/blogPostTags\s+BlogPostTag\[\]/);
    expect(model).toMatch(/blogPosts\s+BlogPost\[\]/);
  });
});

describe('0019 RLS migration — tenant isolation on the blog tables', () => {
  const tables = ['blog_authors', 'blog_categories', 'blog_post_tags', 'blog_posts'];

  for (const table of tables) {
    it(`enables + forces RLS with a fail-closed tenant_isolation policy on ${table}`, () => {
      expect(rlsMigration).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
      expect(rlsMigration).toContain(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`);
      expect(rlsMigration).toContain(`CREATE POLICY tenant_isolation ON ${table}`);
    });
  }

  it('uses the NULLIF-guarded GUC cast for fail-closed isolation', () => {
    expect(rlsMigration).toContain(
      "NULLIF(current_setting('app.current_tenant_id', true), '')::uuid",
    );
  });
});

describe('RLS tenant isolation on blog_posts (pglite — mirrors 0019)', () => {
  const TENANT_A = '11111111-1111-1111-1111-111111111111';
  const TENANT_B = '22222222-2222-2222-2222-222222222222';
  const POST = '44444444-4444-4444-4444-444444444444';

  async function setup(): Promise<PGlite> {
    const db = new PGlite();
    await db.exec(`
      CREATE TABLE blog_posts (
        id uuid NOT NULL,
        tenant_id uuid NOT NULL,
        title text NOT NULL
      );
      ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
      CREATE POLICY tenant_isolation ON blog_posts
        USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
      CREATE ROLE app_user NOLOGIN;
      GRANT SELECT, INSERT ON blog_posts TO app_user;
    `);
    await db.exec(`SET ROLE app_user`);
    return db;
  }

  it('admits only the current tenant rows and fails closed when unset', async () => {
    const db = await setup();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await db.exec(
      `INSERT INTO blog_posts (id, tenant_id, title) VALUES ('${POST}', '${TENANT_A}', 'Hello')`,
    );
    await db.exec(`SET app.current_tenant_id = '${TENANT_B}'`);
    const none = await db.query<{ id: string }>(`SELECT id FROM blog_posts`);
    expect(none.rows).toEqual([]);
    await db.close();
  });

  it('blocks inserting a row for another tenant (WITH CHECK)', async () => {
    const db = await setup();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await expect(
      db.exec(
        `INSERT INTO blog_posts (id, tenant_id, title) VALUES ('${POST}', '${TENANT_B}', 'Nope')`,
      ),
    ).rejects.toThrow();
    await db.close();
  });
});
