-- 0021_seo_ops_rls.sql — Row-Level-Security tenant isolation for the EPIC-J
-- SEO / ops foundation entities (master spec §J, FR-J-1): redirects, seo_metadata
-- and import_logs.
--
-- Each table is tenant-scoped and isolated with the same shape as
-- 0003/0005/.../0016: ENABLE + FORCE RLS (so the table owner the app connects as
-- is also subject to it), with a tenant_isolation policy that admits a row only
-- when its tenant_id equals the per-request GUC `app.current_tenant_id`, set by
-- the client extension with SET LOCAL inside the request transaction. The GUC is
-- wrapped in NULLIF(..., '') before the ::uuid cast so an unscoped connection
-- yields NULL (no rows) rather than a cast error — graceful fail-closed.
--
-- The columns / FKs / unique + indexes are created by `prisma db push` from the
-- Redirect / SeoMetadata / ImportLog models — this raw migration adds ONLY the RLS
-- policy, which Prisma cannot express. The isolation pattern is exercised against
-- pglite in src/seo-ops-schema.test.ts; full Prisma-against-PostgreSQL runs via
-- Testcontainers in CI.

ALTER TABLE redirects ENABLE ROW LEVEL SECURITY;
ALTER TABLE redirects FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON redirects
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

ALTER TABLE seo_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_metadata FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON seo_metadata
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

ALTER TABLE import_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON import_logs
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
