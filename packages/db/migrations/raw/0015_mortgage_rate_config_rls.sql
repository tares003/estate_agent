-- 0015_mortgage_rate_config_rls.sql — Row-Level-Security tenant isolation for the
-- EPIC-W mortgage-default configuration entity (FR-W-7).
--
-- mortgage_rate_config holds each tenant's admin-edited mortgage calculator defaults
-- (one JSON row per tenant: the illustrative rate / term / deposit % + last-reviewed
-- date). Tenant-scoped and isolated with the same shape as 0003/.../0014: ENABLE +
-- FORCE RLS (so the table owner the app connects as is also subject to it), with a
-- tenant_isolation policy that admits a row only when its tenant_id equals the
-- per-request GUC `app.current_tenant_id`, set by the client extension with SET LOCAL
-- inside the request transaction. The GUC is wrapped in NULLIF(..., '') before the
-- ::uuid cast so an unscoped connection yields NULL (no rows) rather than a cast
-- error — graceful fail-closed.
--
-- The isolation pattern is exercised against pglite in src/mortgage-rate-config.test.ts;
-- full Prisma-against-PostgreSQL runs via Testcontainers in CI.

ALTER TABLE mortgage_rate_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE mortgage_rate_config FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON mortgage_rate_config
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
