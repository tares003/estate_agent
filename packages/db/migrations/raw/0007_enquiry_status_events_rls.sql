-- 0007_enquiry_status_events_rls.sql — Row-Level-Security tenant isolation for the
-- enquiry status timeline (master spec §I.3).
--
-- enquiry_status_events is the append-only audit of an enquiry's status
-- transitions (the CRM activity timeline + the basis for SLA / time-to-first-
-- contact metrics). It is tenant-scoped and follows the same isolation shape as
-- 0003/0005: ENABLE + FORCE RLS (so the table owner the app connects as is also
-- subject to it), with a tenant_isolation policy that admits a row only when its
-- tenant_id equals the per-request GUC `app.current_tenant_id`, set by the client
-- extension with SET LOCAL inside the request transaction. The GUC is wrapped in
-- NULLIF(..., '') before the ::uuid cast so an unscoped connection yields NULL
-- (no rows) rather than a cast error — graceful fail-closed.
--
-- The isolation pattern is exercised against pglite in
-- src/enquiry-status-events.test.ts; full Prisma-against-PostgreSQL runs via
-- Testcontainers in CI.

ALTER TABLE enquiry_status_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE enquiry_status_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON enquiry_status_events
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
