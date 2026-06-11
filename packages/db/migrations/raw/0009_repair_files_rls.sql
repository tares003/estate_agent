-- 0009_repair_files_rls.sql — Row-Level-Security tenant isolation for repair
-- ticket files (master spec §G.6, FR-G-2).
--
-- repair_files carries the photos / videos attached to a repair ticket — by the
-- tenant at intake, and by staff / contractors later (completion photos,
-- FR-G-8). file_url holds the StorageBackend key; the bytes are served via the
-- signed-URL route only, so the row is the authorisation record. Tenant-scoped
-- and isolated with the same shape as 0003/0005/0007/0008: ENABLE + FORCE RLS
-- (so the table owner the app connects as is also subject to it), with a
-- tenant_isolation policy that admits a row only when its tenant_id equals the
-- per-request GUC `app.current_tenant_id`, set by the client extension with
-- SET LOCAL inside the request transaction. The GUC is wrapped in
-- NULLIF(..., '') before the ::uuid cast so an unscoped connection yields NULL
-- (no rows) rather than a cast error — graceful fail-closed.
--
-- The isolation pattern is exercised against pglite in src/repair-files.test.ts;
-- full Prisma-against-PostgreSQL runs via Testcontainers in CI.

ALTER TABLE repair_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_files FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON repair_files
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
