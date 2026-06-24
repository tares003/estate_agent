-- 0015_saved_properties_rls.sql — Row-Level-Security tenant isolation for the
-- EPIC-T saved-properties entity (master spec §B.22 / §J, FR-T-5/6).
--
-- saved_properties holds each tenant's customers' favourited properties (one row
-- per customer + property). Tenant-scoped and isolated with the same shape as
-- 0003/0005/.../0014: ENABLE + FORCE RLS (so the table owner the app connects as
-- is also subject to it), with a tenant_isolation policy that admits a row only
-- when its tenant_id equals the per-request GUC `app.current_tenant_id`, set by
-- the client extension with SET LOCAL inside the request transaction. The GUC is
-- wrapped in NULLIF(..., '') before the ::uuid cast so an unscoped connection
-- yields NULL (no rows) rather than a cast error — graceful fail-closed.
--
-- The columns / FKs / unique + indexes are created by `prisma db push` from the
-- SavedProperty model (a plain uuid/timestamp table is Prisma-expressible) — this
-- raw migration adds ONLY the RLS policy, which Prisma cannot express. The
-- isolation pattern is exercised against pglite in src/saved-property.test.ts;
-- full Prisma-against-PostgreSQL runs via Testcontainers in CI.

ALTER TABLE saved_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_properties FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON saved_properties
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
