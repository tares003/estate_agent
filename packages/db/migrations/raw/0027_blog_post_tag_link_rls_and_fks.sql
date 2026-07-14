-- 0027_blog_post_tag_link_rls_and_fks.sql — tenant isolation + SAME-TENANT
-- composite foreign keys for the EPIC-J blog posts <-> tags join
-- (audit finding blog-mn-join-table-outside-rls-and-composite-fk).
--
-- The relation used to be Prisma's IMPLICIT m-n join table
-- (_BlogPostToBlogPostTag). That table carries no tenant_id, so it can hold no
-- RLS policy (0019 isolates only blog_posts / blog_post_tags / blog_categories /
-- blog_authors), and its two single-column FKs check only that the post id and
-- the tag id EXIST — never that they belong to the same tenant.
--
-- PostgreSQL validates a foreign key with row-level security BYPASSED, so RLS
-- protects only the row being written, never the existence check of the
-- referenced parent. A tenant-scoped write connecting tenant A's post to tenant
-- B's TAG id would therefore be structurally insertable: the WITH CHECK on the
-- post is satisfied (it is tenant A's own post), and the FK lookup happily finds
-- tenant B's tag. That is exactly the D-012 class 0006_composite_tenant_fks.sql
-- was created to close for the branch / property relations, left uncovered for
-- the blog join. It is LATENT today — blog.ts is read-only and no blogPost
-- create/update/connect path exists — so this is hardening BEFORE the write path
-- lands, not a live leak. It also removes a weak cross-tenant tag-UUID existence
-- oracle (a rejected vs. accepted connect distinguishes a real foreign tag id).
--
-- The fix replaces the implicit relation with the EXPLICIT BlogPostTagLink model
-- (blog_post_tag_links), which carries tenant_id. The columns / PK / indexes /
-- single-column FKs come from `prisma db push` off schema.prisma (raw SQL is
-- reserved for RLS / indexes / PostGIS / constraint re-pointing — CLAUDE.md §9);
-- `db push` also DROPS the now-unreferenced _BlogPostToBlogPostTag table. This
-- migration adds the two things Prisma cannot express:
--
--   1. Composite FKs. Each parent gains a UNIQUE (tenant_id, id) index (the FK
--      target), and each side of the join is re-pointed from its single-column FK
--      to the composite one, so the reference must match (tenant_id, id): a
--      cross-tenant post or tag id finds NO parent row and the write is rejected
--      by the engine, RLS or not. Both sides are NOT NULL and keep the schema's
--      cascade-on-delete (a link is not an entity in its own right — deleting the
--      post or the tag deletes the link).
--
--   2. RLS. ENABLE + FORCE ROW LEVEL SECURITY with the standard tenant_isolation
--      policy (same shape as 0003/0005/…/0019/0026), so the table owner the app
--      connects as is also subject to it. The GUC is wrapped in NULLIF(…, '')
--      before the ::uuid cast, so an unscoped connection yields NULL — no rows,
--      fail-closed — rather than a cast error.
--
-- The DROP … IF EXISTS lines remove the Prisma-generated single-column FKs by
-- their conventional `<table>_<column>_fkey` names; if a name differs the drop is
-- a harmless no-op and the (stricter) composite FK still governs writes.
-- tenant_id's own FK to platform_tenants is left intact.
--
-- Idempotent (IF EXISTS / IF NOT EXISTS + drop-before-add). Applied after 0019
-- (the blog tables + their RLS exist). Both mechanisms are verified on pglite
-- (PG16) in src/blog-post-tag-link.test.ts — the FK rejection as superuser (RLS
-- bypassed, precisely the condition the FK check runs under) and the policy as a
-- non-owner role; the full apply against PostgreSQL runs via Testcontainers in CI.

-- ── Parent unique targets (the columns each composite FK references) ──────────
CREATE UNIQUE INDEX IF NOT EXISTS blog_posts_tenant_id_id_key     ON blog_posts     (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS blog_post_tags_tenant_id_id_key ON blog_post_tags (tenant_id, id);

-- ── blog_post_tag_links.blog_post_id → blog_posts (NOT NULL → CASCADE) ────────
ALTER TABLE blog_post_tag_links DROP CONSTRAINT IF EXISTS blog_post_tag_links_blog_post_id_fkey;
ALTER TABLE blog_post_tag_links DROP CONSTRAINT IF EXISTS blog_post_tag_links_tenant_post_fkey;
ALTER TABLE blog_post_tag_links ADD CONSTRAINT blog_post_tag_links_tenant_post_fkey
  FOREIGN KEY (tenant_id, blog_post_id) REFERENCES blog_posts (tenant_id, id)
  ON UPDATE CASCADE ON DELETE CASCADE;

-- ── blog_post_tag_links.blog_post_tag_id → blog_post_tags (NOT NULL → CASCADE) ─
ALTER TABLE blog_post_tag_links DROP CONSTRAINT IF EXISTS blog_post_tag_links_blog_post_tag_id_fkey;
ALTER TABLE blog_post_tag_links DROP CONSTRAINT IF EXISTS blog_post_tag_links_tenant_tag_fkey;
ALTER TABLE blog_post_tag_links ADD CONSTRAINT blog_post_tag_links_tenant_tag_fkey
  FOREIGN KEY (tenant_id, blog_post_tag_id) REFERENCES blog_post_tags (tenant_id, id)
  ON UPDATE CASCADE ON DELETE CASCADE;

-- ── Tenant isolation on the join rows themselves ──────────────────────────────
ALTER TABLE blog_post_tag_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_post_tag_links FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON blog_post_tag_links;
CREATE POLICY tenant_isolation ON blog_post_tag_links
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
