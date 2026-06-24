-- 0014_sdlt_config_rls.sql — Row-Level-Security tenant isolation for the EPIC-W
-- SDLT band-configuration entity (FR-W-3).
--
-- sdlt_config holds each tenant's admin-edited stamp-duty band set (one JSON row
-- per tenant). Tenant-scoped and isolated with the same shape as
-- 0003/0005/.../0013: ENABLE + FORCE RLS (so the table owner the app connects as
-- is also subject to it), with a tenant_isolation policy that admits a row only
-- when its tenant_id equals the per-request GUC `app.current_tenant_id`, set by
-- the client extension with SET LOCAL inside the request transaction. The GUC is
-- wrapped in NULLIF(..., '') before the ::uuid cast so an unscoped connection
-- yields NULL (no rows) rather than a cast error — graceful fail-closed.
--
-- The isolation pattern is exercised against pglite in src/sdlt-config.test.ts;
-- full Prisma-against-PostgreSQL runs via Testcontainers in CI.

ALTER TABLE sdlt_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE sdlt_config FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON sdlt_config
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
