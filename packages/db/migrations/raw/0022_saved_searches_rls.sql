-- 0022_saved_searches_rls.sql — Row-Level-Security tenant isolation for the
-- EPIC-J saved-searches entity (master spec §J line 1343-1344, FR-T-7/8).
--
-- saved_searches holds each tenant's customers' saved search filters (one row
-- per customer + named search) with an email-alert cadence. Tenant-scoped and
-- isolated with the same shape as 0003/0005/.../0018: ENABLE + FORCE RLS (so the
-- table owner the app connects as is also subject to it), with a tenant_isolation
-- policy that admits a row only when its tenant_id equals the per-request GUC
-- `app.current_tenant_id`, set by the client extension with SET LOCAL inside the
-- request transaction. The GUC is wrapped in NULLIF(..., '') before the ::uuid
-- cast so an unscoped connection yields NULL (no rows) rather than a cast error —
-- graceful fail-closed.
--
-- The columns / FKs / unique + indexes are created by `prisma db push` from the
-- SavedSearch model (a plain uuid/json/timestamp/enum table is Prisma-expressible)
-- — this raw migration adds ONLY the RLS policy, which Prisma cannot express. The
-- isolation pattern is exercised against pglite in src/saved-search.test.ts; full
-- Prisma-against-PostgreSQL runs via Testcontainers in CI.

ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON saved_searches
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
