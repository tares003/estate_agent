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
-- adds ONLY the RLS policies, which Prisma cannot express.
--
-- CORRECTION (audit finding blog-mn-join-table-outside-rls-and-composite-fk):
-- this file originally left the posts<->tags m-n join out of RLS on the grounds
-- that it "is reachable only through the already-isolated blog_posts and
-- blog_post_tags rows". That rationale covers READS — it does NOT cover an
-- FK-checked CONNECT. PostgreSQL validates a foreign key with RLS BYPASSED, so a
-- tenant-scoped write could link tenant A's post to tenant B's TAG id: the join
-- row itself passed no policy (it had none), and the FK's parent lookup saw the
-- other tenant's tag regardless of isolation. The join is therefore no longer an
-- implicit table: it is the EXPLICIT, tenant_id-carrying blog_post_tag_links, put
-- under FORCE RLS and re-pointed to composite same-tenant FKs by
-- 0027_blog_post_tag_link_rls_and_fks.sql (the 0006 hardening, extended to the
-- blog). See src/blog-post-tag-link.test.ts.
--
-- The isolation pattern below is exercised against pglite in
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
