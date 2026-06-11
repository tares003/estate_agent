-- 0008_repair_status_history_rls.sql — Row-Level-Security tenant isolation for the
-- repair ticket status history (master spec §G.5/§G.6, FR-G-7).
--
-- repair_status_history is the append-only audit of a repair ticket's status
-- transitions (from/to, actor, notes, timestamp — the basis for the ticket
-- timeline and the SLA metrics). It is tenant-scoped and follows the same
-- isolation shape as 0003/0005/0007: ENABLE + FORCE RLS (so the table owner the
-- app connects as is also subject to it), with a tenant_isolation policy that
-- admits a row only when its tenant_id equals the per-request GUC
-- `app.current_tenant_id`, set by the client extension with SET LOCAL inside the
-- request transaction. The GUC is wrapped in NULLIF(..., '') before the ::uuid
-- cast so an unscoped connection yields NULL (no rows) rather than a cast error —
-- graceful fail-closed.
--
-- The isolation pattern is exercised against pglite in
-- src/repair-status-history.test.ts; full Prisma-against-PostgreSQL runs via
-- Testcontainers in CI.

ALTER TABLE repair_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_status_history FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON repair_status_history
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
