-- 0002_rls_policies.sql — Row-Level-Security tenant isolation.
--
-- Every tenant-owned table enables (and FORCEs, so the table owner the app
-- connects as is also subject to) RLS, with a policy that admits only rows whose
-- tenant_id equals the per-request GUC `app.current_tenant_id`. The client
-- extension (src/tenant-extension.ts) sets that GUC with SET LOCAL inside the
-- request transaction. A custom GUC defaults to an empty string when unset, so
-- the policy wraps it in NULLIF(..., '') before the ::uuid cast: an unscoped
-- connection yields NULL (no rows) instead of a cast error — graceful fail-closed.
--
-- platform_tenants is intentionally NOT under RLS — it is the operator-owned
-- tenant registry. Operator-admin handlers use a privileged role that bypasses
-- RLS (CLAUDE.md §9). The same isolation pattern below is what src/rls.test.ts
-- verifies against pglite.

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON users
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON audit_logs
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

ALTER TABLE consent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON consent_logs
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON notification_logs
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
