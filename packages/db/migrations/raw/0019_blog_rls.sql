-- 0019_blog_rls.sql — Row-Level-Security tenant isolation for the EPIC-J blog
-- entities (master spec §J "Blog post" / "Blog category" / "Blog post tag" /
-- "Blog author"; §H admin Blog tab).
--
-- The blog knowledge hub is four tenant-scoped tables: blog_authors (by-lines),
-- blog_categories, blog_post_tags (the tag entity) and blog_posts (the article,
-- with a block-based Json body, draft/scheduled/published status, schedule
-- timestamps and SEO meta). Each is isolated with the same shape as
-- 0003/0005/.../0018: ENABLE + FORCE RLS (so the table owner the app connects as
-- is also subject to it), with a tenant_isolation policy that admits a row only
-- when its tenant_id equals the per-request GUC `app.current_tenant_id`, set by
-- the client extension with SET LOCAL inside the request transaction. The GUC is
-- wrapped in NULLIF(..., '') before the ::uuid cast so an unscoped connection
-- yields NULL (no rows) rather than a cast error — graceful fail-closed.
--
-- The columns / FKs / unique + indexes are created by `prisma db push` from the
-- BlogAuthor / BlogCategory / BlogPostTag / BlogPost models — this raw migration
-- adds ONLY the RLS policies, which Prisma cannot express. The posts<->tags m-n
-- uses Prisma's implicit join table (_BlogPostToBlogPostTag); it is reachable only
-- through the already-isolated blog_posts and blog_post_tags rows, so no separate
-- policy is added here. The isolation pattern is exercised against pglite in
-- src/blog-schema.test.ts; full Prisma-against-PostgreSQL runs via Testcontainers
-- in CI.

ALTER TABLE blog_authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_authors FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON blog_authors
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

ALTER TABLE blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_categories FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON blog_categories
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

ALTER TABLE blog_post_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_post_tags FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON blog_post_tags
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON blog_posts
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
