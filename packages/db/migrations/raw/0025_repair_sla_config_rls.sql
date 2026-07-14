-- 0025_repair_sla_config_rls.sql — Row-Level-Security tenant isolation for the
-- EPIC-G repair SLA configuration entity (FR-G-5 / FR-G-9; audit finding
-- repair-urgency-sla-not-configurable).
--
-- repair_sla_config holds each tenant's repair SLA settings (one row per tenant):
-- the per-urgency SLA targets master spec §G.4 marks "(configurable)" — emergency
-- / urgent / standard in hours, non-urgent in working days — plus the two FR-G-9
-- SLA-breach-badge thresholds (due-soon and at-risk, as a percentage of the target
-- elapsed; breach stays fixed at 100%). Every column carries the §G.4 / FR-G-9
-- default, and the read model falls back to those same defaults when no row exists,
-- so an unconfigured tenant is unchanged.
--
-- Tenant-scoped and isolated with the same shape as 0003/0005/.../0015/0024: ENABLE
-- + FORCE RLS (so the table owner the app connects as is also subject to it), with
-- a tenant_isolation policy that admits a row only when its tenant_id equals the
-- per-request GUC `app.current_tenant_id`, set by the client extension with SET
-- LOCAL inside the request transaction. The GUC is wrapped in NULLIF(..., '')
-- before the ::uuid cast so an unscoped connection yields NULL (no rows) rather
-- than a cast error — graceful fail-closed.
--
-- Columns themselves come from `prisma db push` off schema.prisma (this file adds
-- no columns — raw SQL is reserved for RLS / indexes / PostGIS). The isolation
-- pattern is exercised against pglite in src/repair-sla-config.test.ts; full
-- Prisma-against-PostgreSQL runs via Testcontainers in CI.

ALTER TABLE repair_sla_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_sla_config FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON repair_sla_config
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
