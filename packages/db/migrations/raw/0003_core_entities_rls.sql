-- 0003_core_entities_rls.sql — Row-Level-Security tenant isolation for the §J
-- core (always-on) catalogue + CRM tables.
--
-- Each table below ENABLEs (and FORCEs, so the table owner the app connects as
-- is also subject to) RLS, with the same tenant_isolation policy shape as
-- 0002_rls_policies.sql: a row is admitted only when its tenant_id equals the
-- per-request GUC `app.current_tenant_id`, set by the client extension with
-- SET LOCAL inside the request transaction. The GUC is wrapped in
-- NULLIF(..., '') before the ::uuid cast so an unscoped connection yields NULL
-- (no rows) rather than a cast error — graceful fail-closed.
--
-- platform_tenants stays out of RLS (it is the operator-owned tenant registry;
-- operator-admin handlers use a privileged role that bypasses RLS — CLAUDE.md
-- §9). The isolation pattern is exercised against pglite in
-- src/core-entities.test.ts; full Prisma-against-PostgreSQL + PostGIS runs via
-- Testcontainers in CI.

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON branches
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON agents
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON properties
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

ALTER TABLE enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE enquiries FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON enquiries
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

ALTER TABLE viewings ENABLE ROW LEVEL SECURITY;
ALTER TABLE viewings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON viewings
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

ALTER TABLE valuations ENABLE ROW LEVEL SECURITY;
ALTER TABLE valuations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON valuations
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

ALTER TABLE repair_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON repair_requests
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON contacts
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
