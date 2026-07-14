-- 0024_repair_notification_config_rls.sql — Row-Level-Security tenant isolation
-- for the EPIC-G repair notification routing entity (FR-G-3; audit finding
-- repair-emergency-internal-notifications-missing).
--
-- repair_notification_config holds each tenant's internal repair-notification
-- recipients (one row per tenant): the property-manager / branch-repairs-queue
-- email alerted on every submission and the on-call manager's phone paged on an
-- emergency submission (master spec §G.7). Tenant-scoped and isolated with the
-- same shape as 0003/0005/.../0015: ENABLE + FORCE RLS (so the table owner the
-- app connects as is also subject to it), with a tenant_isolation policy that
-- admits a row only when its tenant_id equals the per-request GUC
-- `app.current_tenant_id`, set by the client extension with SET LOCAL inside the
-- request transaction. The GUC is wrapped in NULLIF(..., '') before the ::uuid
-- cast so an unscoped connection yields NULL (no rows) rather than a cast error —
-- graceful fail-closed.
--
-- The isolation pattern is exercised against pglite in
-- src/repair-notification-config.test.ts; full Prisma-against-PostgreSQL runs via
-- Testcontainers in CI.

ALTER TABLE repair_notification_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_notification_config FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON repair_notification_config
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
