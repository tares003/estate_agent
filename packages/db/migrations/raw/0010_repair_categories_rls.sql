-- 0010_repair_categories_rls.sql — Row-Level-Security tenant isolation for the
-- admin-editable repair category catalogue (master spec §G.3, FR-G-4).
--
-- repair_categories holds each tenant's repair-category catalogue (slug, label,
-- icon, default urgency, auto-assign role, order, visibility). Tenant-scoped and
-- isolated with the same shape as 0003/0005/0007/0008/0009: ENABLE + FORCE RLS
-- (so the table owner the app connects as is also subject to it), with a
-- tenant_isolation policy that admits a row only when its tenant_id equals the
-- per-request GUC `app.current_tenant_id`, set by the client extension with
-- SET LOCAL inside the request transaction. The GUC is wrapped in
-- NULLIF(..., '') before the ::uuid cast so an unscoped connection yields NULL
-- (no rows) rather than a cast error — graceful fail-closed.
--
-- The isolation pattern is exercised against pglite in
-- src/repair-categories.test.ts; full Prisma-against-PostgreSQL runs via
-- Testcontainers in CI.

ALTER TABLE repair_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_categories FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON repair_categories
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
