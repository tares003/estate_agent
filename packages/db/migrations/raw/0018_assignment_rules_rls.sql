-- 0018_assignment_rules_rls.sql — Row-Level-Security tenant isolation for the
-- EPIC-H assignment-rules entity (master spec §H.6, FR-H-4).
--
-- assignment_rules holds each tenant's no-code enquiry-routing rules (one row per
-- IF/THEN rule, ordered by position for top-down first-match-wins evaluation).
-- Tenant-scoped and isolated with the same shape as 0003/0005/.../0016: ENABLE +
-- FORCE RLS (so the table owner the app connects as is also subject to it), with a
-- tenant_isolation policy that admits a row only when its tenant_id equals the
-- per-request GUC `app.current_tenant_id`, set by the client extension with SET
-- LOCAL inside the request transaction. The GUC is wrapped in NULLIF(..., '')
-- before the ::uuid cast so an unscoped connection yields NULL (no rows) rather
-- than a cast error — graceful fail-closed.
--
-- The columns / FK / indexes are created by `prisma db push` from the
-- AssignmentRule model (a plain uuid/jsonb/int table is Prisma-expressible) — this
-- raw migration adds ONLY the RLS policy, which Prisma cannot express. The
-- isolation pattern is exercised against pglite in src/assignment-rule.test.ts;
-- full Prisma-against-PostgreSQL runs via Testcontainers in CI.

ALTER TABLE assignment_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_rules FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON assignment_rules
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
