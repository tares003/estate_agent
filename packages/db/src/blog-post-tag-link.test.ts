import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

// EPIC-J blog posts <-> tags join (audit finding
// blog-mn-join-table-outside-rls-and-composite-fk).
//
// The relation used to be Prisma's IMPLICIT m-n join table (_BlogPostToBlogPostTag),
// which carries no tenant_id, gets no RLS policy, and is not covered by the 0006
// composite-FK hardening. Postgres validates a foreign key with RLS BYPASSED, so a
// tenant-scoped write connecting tenant A's post to tenant B's TAG id was
// structurally insertable — the D-012 class 0006 exists to close, left uncovered for
// the blog join. Latent only (blog.ts is read-only; no write path exists yet), so
// this is hardening BEFORE the write path lands, not a live leak.
//
// The fix is an EXPLICIT join model (BlogPostTagLink -> blog_post_tag_links) that
//   - carries tenant_id,
//   - is re-pointed to composite (tenant_id, blog_post_id) / (tenant_id,
//     blog_post_tag_id) FKs so a cross-tenant connect finds no parent row, and
//   - is itself under FORCE RLS with the standard tenant_isolation policy.
//
// Asserts the schema source + the raw SQL, and exercises BOTH mechanisms against
// pglite: the FK rejection (as superuser — precisely the condition under which RLS
// would NOT have protected the reference) and the RLS policy (as a non-owner role).

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const schema = readFileSync(join(root, 'prisma', 'schema.prisma'), 'utf8');
const migration = readFileSync(
  join(root, 'migrations', 'raw', '0027_blog_post_tag_link_rls_and_fks.sql'),
  'utf8',
);
const blogRls = readFileSync(join(root, 'migrations', 'raw', '0019_blog_rls.sql'), 'utf8');

function block(name: string, kind: 'model' | 'enum'): string {
  const match = schema.match(new RegExp(`${kind} ${name} \\{[\\s\\S]*?\\n\\}`, 'm'));
  expect(match, `${kind} ${name} should be declared`).not.toBeNull();
  return match![0];
}

describe('BlogPostTagLink — schema (blog_post_tag_links)', () => {
  it('is declared, tenant-scoped, and mapped to blog_post_tag_links', () => {
    const model = block('BlogPostTagLink', 'model');
    expect(model).toContain('@@map("blog_post_tag_links")');
    expect(model).toMatch(/tenantId\s+String\s+@map\("tenant_id"\)\s+@db\.Uuid/);
    expect(model).toMatch(/tenant\s+PlatformTenant\s+@relation\([^)]*onDelete:\s*Cascade/);
  });

  it('carries both sides of the join as tenant-scoped uuid columns', () => {
    const model = block('BlogPostTagLink', 'model');
    expect(model).toMatch(/blogPostId\s+String\s+@map\("blog_post_id"\)\s+@db\.Uuid/);
    expect(model).toMatch(/blogPostTagId\s+String\s+@map\("blog_post_tag_id"\)\s+@db\.Uuid/);
    expect(model).toMatch(/post\s+BlogPost\s+@relation\([^)]*onDelete:\s*Cascade/);
    expect(model).toMatch(/tag\s+BlogPostTag\s+@relation\([^)]*onDelete:\s*Cascade/);
  });

  it('holds at most one link per (post, tag) pair and indexes the tag-archive lookup', () => {
    const model = block('BlogPostTagLink', 'model');
    expect(model).toContain('@@id([blogPostId, blogPostTagId])');
    expect(model).toContain('@@index([tenantId, blogPostTagId])');
  });
});

describe('BlogPost / BlogPostTag — the m-n now goes through the explicit join', () => {
  it('BlogPost.tags points at the join model, not the implicit BlogPostTag[]', () => {
    const model = block('BlogPost', 'model');
    expect(model).toMatch(/tags\s+BlogPostTagLink\[\]/);
    expect(model).not.toMatch(/tags\s+BlogPostTag\[\]/);
  });

  it('BlogPostTag.posts points at the join model, not the implicit BlogPost[]', () => {
    const model = block('BlogPostTag', 'model');
    expect(model).toMatch(/posts\s+BlogPostTagLink\[\]/);
    expect(model).not.toMatch(/posts\s+BlogPost\[\]/);
  });

  it('PlatformTenant back-relates the join rows (they are tenant-owned)', () => {
    expect(block('PlatformTenant', 'model')).toMatch(/blogPostTagLinks\s+BlogPostTagLink\[\]/);
  });
});

describe('0027 migration content (guards the real migration file)', () => {
  it('creates the UNIQUE (tenant_id, id) FK targets on both parents', () => {
    expect(migration).toMatch(/CREATE UNIQUE INDEX[^;]*\bblog_posts\b[^;]*\(tenant_id, id\)/i);
    expect(migration).toMatch(/CREATE UNIQUE INDEX[^;]*\bblog_post_tags\b[^;]*\(tenant_id, id\)/i);
  });

  it('re-points both single-column FKs prisma db push creates onto composite ones', () => {
    for (const fk of ['blog_post_id', 'blog_post_tag_id']) {
      expect(migration).toMatch(
        new RegExp(`DROP CONSTRAINT IF EXISTS blog_post_tag_links_${fk}_fkey`, 'i'),
      );
    }
    expect(migration).toMatch(
      /FOREIGN KEY \(tenant_id, blog_post_id\)\s*REFERENCES blog_posts \(tenant_id, id\)/i,
    );
    expect(migration).toMatch(
      /FOREIGN KEY \(tenant_id, blog_post_tag_id\)\s*REFERENCES blog_post_tags \(tenant_id, id\)/i,
    );
    // Deleting a post or a tag removes its links (the m-n rows are not standalone).
    expect(migration.match(/ON DELETE CASCADE/gi)).toHaveLength(2);
  });

  it('enables + forces RLS with a fail-closed tenant_isolation policy on the join table', () => {
    expect(migration).toContain('ALTER TABLE blog_post_tag_links ENABLE ROW LEVEL SECURITY;');
    expect(migration).toContain('ALTER TABLE blog_post_tag_links FORCE ROW LEVEL SECURITY;');
    expect(migration).toContain('CREATE POLICY tenant_isolation ON blog_post_tag_links');
    expect(migration).toContain("NULLIF(current_setting('app.current_tenant_id', true), '')::uuid");
  });
});

describe('0019 — its rationale is corrected for FK-checked connects', () => {
  it('no longer claims the implicit join needs no policy of its own', () => {
    expect(blogRls).not.toContain('_BlogPostToBlogPostTag');
    // The old "reachable only through isolated rows" rationale covered READS but
    // not FK-checked CONNECTS; 0019 must now point at 0027 for the join table.
    expect(blogRls).toMatch(/0027/);
  });
});

// ── Behaviour (pglite applies the REAL 0027 migration) ───────────────────────

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';
const POST_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const TAG_A = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const POST_B = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const TAG_B = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

// Minimal versions of the three tables 0027 touches — only the FK-relevant
// columns, matching what `prisma db push` creates from the schema (the link's own
// composite PK, both single-column FKs, all NOT NULL).
const MINIMAL_SCHEMA = `
  CREATE TABLE blog_posts (id uuid PRIMARY KEY, tenant_id uuid NOT NULL);
  CREATE TABLE blog_post_tags (id uuid PRIMARY KEY, tenant_id uuid NOT NULL);
  CREATE TABLE blog_post_tag_links (
    tenant_id uuid NOT NULL,
    blog_post_id uuid NOT NULL,
    blog_post_tag_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (blog_post_id, blog_post_tag_id),
    CONSTRAINT blog_post_tag_links_blog_post_id_fkey
      FOREIGN KEY (blog_post_id) REFERENCES blog_posts (id) ON DELETE CASCADE,
    CONSTRAINT blog_post_tag_links_blog_post_tag_id_fkey
      FOREIGN KEY (blog_post_tag_id) REFERENCES blog_post_tags (id) ON DELETE CASCADE
  );
`;

const SEED = `
  INSERT INTO blog_posts (id, tenant_id) VALUES ('${POST_A}','${TENANT_A}'), ('${POST_B}','${TENANT_B}');
  INSERT INTO blog_post_tags (id, tenant_id) VALUES ('${TAG_A}','${TENANT_A}'), ('${TAG_B}','${TENANT_B}');
`;

/** A pglite DB with the minimal blog tables, one post + one tag per tenant, and 0027 applied. */
async function migratedDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(MINIMAL_SCHEMA);
  await db.exec(SEED);
  await db.exec(migration);
  return db;
}

const FK_VIOLATION = /violates foreign key constraint/i;

describe('composite tenant FK on blog_post_tag_links (pglite applies 0027)', () => {
  it('demonstrates the hole: the implicit join admits a cross-tenant tag connect', async () => {
    // The OLD shape — Prisma's implicit _BlogPostToBlogPostTag, two single-column
    // FKs and no tenant_id — checks only that BOTH ids exist, never that they
    // belong to the SAME tenant. So tenant A's post links to tenant B's tag.
    const db = new PGlite();
    await db.exec(`
      CREATE TABLE blog_posts (id uuid PRIMARY KEY, tenant_id uuid NOT NULL);
      CREATE TABLE blog_post_tags (id uuid PRIMARY KEY, tenant_id uuid NOT NULL);
      CREATE TABLE "_BlogPostToBlogPostTag" (
        "A" uuid NOT NULL REFERENCES blog_posts (id),
        "B" uuid NOT NULL REFERENCES blog_post_tags (id)
      );
    `);
    await db.exec(SEED);
    await db.exec(`INSERT INTO "_BlogPostToBlogPostTag" ("A","B") VALUES ('${POST_A}','${TAG_B}')`);
    const rows = await db.query(`SELECT "A" FROM "_BlogPostToBlogPostTag"`);
    expect(rows.rows).toHaveLength(1); // wrongly accepted — the gap 0027 closes
    await db.close();
  });

  it('accepts a same-tenant link', async () => {
    const db = await migratedDb();
    await db.exec(
      `INSERT INTO blog_post_tag_links (tenant_id, blog_post_id, blog_post_tag_id)
       VALUES ('${TENANT_A}','${POST_A}','${TAG_A}')`,
    );
    const rows = await db.query(`SELECT blog_post_id FROM blog_post_tag_links`);
    expect(rows.rows).toEqual([{ blog_post_id: POST_A }]);
    await db.close();
  });

  it('rejects connecting tenant A’s post to tenant B’s tag (the audit finding)', async () => {
    const db = await migratedDb();
    // Runs as superuser (RLS bypassed) — exactly the condition under which the FK
    // existence check happens, and under which RLS alone would NOT have helped.
    await expect(
      db.exec(
        `INSERT INTO blog_post_tag_links (tenant_id, blog_post_id, blog_post_tag_id)
         VALUES ('${TENANT_A}','${POST_A}','${TAG_B}')`,
      ),
    ).rejects.toThrow(FK_VIOLATION);
    await db.close();
  });

  it('rejects a link row whose tenant_id matches neither parent', async () => {
    const db = await migratedDb();
    await expect(
      db.exec(
        `INSERT INTO blog_post_tag_links (tenant_id, blog_post_id, blog_post_tag_id)
         VALUES ('${TENANT_B}','${POST_A}','${TAG_A}')`,
      ),
    ).rejects.toThrow(FK_VIOLATION);
    await db.close();
  });

  it('rejects an UPDATE that re-points a link at another tenant’s tag', async () => {
    const db = await migratedDb();
    await db.exec(
      `INSERT INTO blog_post_tag_links (tenant_id, blog_post_id, blog_post_tag_id)
       VALUES ('${TENANT_A}','${POST_A}','${TAG_A}')`,
    );
    await expect(
      db.exec(`UPDATE blog_post_tag_links SET blog_post_tag_id = '${TAG_B}'`),
    ).rejects.toThrow(FK_VIOLATION);
    await db.close();
  });

  it('cascade-deletes the link when its post is deleted', async () => {
    const db = await migratedDb();
    await db.exec(
      `INSERT INTO blog_post_tag_links (tenant_id, blog_post_id, blog_post_tag_id)
       VALUES ('${TENANT_A}','${POST_A}','${TAG_A}')`,
    );
    await db.exec(`DELETE FROM blog_posts WHERE id = '${POST_A}'`);
    const rows = await db.query(`SELECT blog_post_id FROM blog_post_tag_links`);
    expect(rows.rows).toEqual([]);
    await db.close();
  });

  it('cascade-deletes the link when its tag is deleted', async () => {
    const db = await migratedDb();
    await db.exec(
      `INSERT INTO blog_post_tag_links (tenant_id, blog_post_id, blog_post_tag_id)
       VALUES ('${TENANT_A}','${POST_A}','${TAG_A}')`,
    );
    await db.exec(`DELETE FROM blog_post_tags WHERE id = '${TAG_A}'`);
    const rows = await db.query(`SELECT blog_post_id FROM blog_post_tag_links`);
    expect(rows.rows).toEqual([]);
    await db.close();
  });
});

describe('RLS tenant isolation on blog_post_tag_links (pglite applies 0027)', () => {
  /** The migrated DB, granted to and assumed as a non-owner app role (RLS applies). */
  async function scopedDb(): Promise<PGlite> {
    const db = await migratedDb();
    await db.exec(`
      CREATE ROLE app_user NOLOGIN;
      GRANT SELECT, INSERT, UPDATE, DELETE ON blog_post_tag_links TO app_user;
      GRANT SELECT ON blog_posts, blog_post_tags TO app_user;
    `);
    await db.exec(`SET ROLE app_user`);
    return db;
  }

  it('admits only the current tenant’s links and fails closed when unset', async () => {
    const db = await scopedDb();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await db.exec(
      `INSERT INTO blog_post_tag_links (tenant_id, blog_post_id, blog_post_tag_id)
       VALUES ('${TENANT_A}','${POST_A}','${TAG_A}')`,
    );

    await db.exec(`SET app.current_tenant_id = '${TENANT_B}'`);
    const other = await db.query(`SELECT blog_post_id FROM blog_post_tag_links`);
    expect(other.rows).toEqual([]);

    // Unscoped connection: the GUC is empty, NULLIF yields NULL, no rows.
    await db.exec(`SET app.current_tenant_id = ''`);
    const unscoped = await db.query(`SELECT blog_post_id FROM blog_post_tag_links`);
    expect(unscoped.rows).toEqual([]);
    await db.close();
  });

  it('blocks writing a link row stamped with another tenant (WITH CHECK)', async () => {
    const db = await scopedDb();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await expect(
      db.exec(
        `INSERT INTO blog_post_tag_links (tenant_id, blog_post_id, blog_post_tag_id)
         VALUES ('${TENANT_B}','${POST_B}','${TAG_B}')`,
      ),
    ).rejects.toThrow();
    await db.close();
  });

  it('blocks a tenant-scoped connect to another tenant’s tag — RLS passes, the FK does not', async () => {
    // The whole point of the finding: the WITH CHECK is satisfied (tenant_id is
    // the writer's own tenant), the row itself is legitimate — and the composite
    // FK is what refuses the cross-tenant tag id, because the FK's parent lookup
    // runs with RLS bypassed and would otherwise have found tenant B's tag.
    const db = await scopedDb();
    await db.exec(`SET app.current_tenant_id = '${TENANT_A}'`);
    await expect(
      db.exec(
        `INSERT INTO blog_post_tag_links (tenant_id, blog_post_id, blog_post_tag_id)
         VALUES ('${TENANT_A}','${POST_A}','${TAG_B}')`,
      ),
    ).rejects.toThrow(FK_VIOLATION);
    await db.close();
  });
});
