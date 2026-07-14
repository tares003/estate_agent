-- 0026_worker_scheduler_rls.sql — Row-Level-Security tenant isolation for the EPIC-U
-- scheduled-tasks entities (FR-U-7 / FR-U-8; audit finding no-admin-scheduled-tasks-console).
--
-- worker_runs is the run log the scheduled-tasks console reads (master spec §H.23: last
-- run, outcome, average runtime). A "run" is ONE TENANT's slice of a worker tick, not the
-- platform-wide tick, because /admin/scheduled-tasks is a TENANT admin surface: a tenant
-- must see only its own worker history, and "average runtime" must mean the runtime of
-- its own work. That makes the row naturally tenant-scoped like every other tenant table.
--
-- worker_schedules is the per-tenant, per-worker control state: the FR-U-8 pause flag
-- ("pause-able from the admin without redeploy") and the pending Run-now request. Run-now
-- is a REQUEST rather than a direct invocation because apps/web has no BullMQ producer —
-- the admin action stamps run_requested_at inside its tenant transaction and the worker's
-- own tick picks it up and clears it, which needs no new infrastructure.
--
-- Both are isolated with the same shape as 0003/0005/.../0024/0025: ENABLE + FORCE RLS
-- (so the table owner the app connects as is also subject to it), with a tenant_isolation
-- policy admitting a row only when its tenant_id equals the per-request GUC
-- `app.current_tenant_id`, set by the client extension with SET LOCAL inside the request
-- transaction. The GUC is wrapped in NULLIF(..., '') before the ::uuid cast so an
-- unscoped connection yields NULL (no rows) rather than a cast error — fail-closed.
--
-- The workers process writes these rows INSIDE withTenant (per tenant), so it is subject
-- to the same policy — a worker can never record a run against the wrong tenant.
--
-- Columns come from `prisma db push` off schema.prisma (this file adds none — raw SQL is
-- reserved for RLS / indexes / PostGIS).

ALTER TABLE worker_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_runs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON worker_runs
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

ALTER TABLE worker_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_schedules FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON worker_schedules
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
