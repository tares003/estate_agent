-- 0005_satellite_rls.sql — Row-Level-Security tenant isolation for the §J
-- satellite entities that hang off the core catalogue.
--
-- property_images + property_documents carry a property's media and paperwork
-- (EPIC-F §F.1); notes is the polymorphic CRM/internal annotation (master spec
-- §J.5); property_status_events is the append-only audit of market_status
-- changes (master spec §J.3 lifecycle). Every table is tenant-scoped and follows
-- the same isolation shape as 0002/0003: ENABLE + FORCE RLS (so the table owner
-- the app connects as is also subject to it), with a tenant_isolation policy
-- that admits a row only when its tenant_id equals the per-request GUC
-- `app.current_tenant_id`, set by the client extension with SET LOCAL inside the
-- request transaction. The GUC is wrapped in NULLIF(..., '') before the ::uuid
-- cast so an unscoped connection yields NULL (no rows) rather than a cast
-- error — graceful fail-closed.
--
-- platform_tenants stays out of RLS (operator-owned registry — CLAUDE.md §9).
-- The isolation pattern is exercised against pglite in src/satellite-entities.test.ts;
-- full Prisma-against-PostgreSQL runs via Testcontainers in CI.

ALTER TABLE property_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_images FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON property_images
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

ALTER TABLE property_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_documents FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON property_documents
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON notes
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

ALTER TABLE property_status_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_status_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON property_status_events
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
