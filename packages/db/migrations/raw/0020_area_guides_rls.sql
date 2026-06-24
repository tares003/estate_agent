-- 0020_area_guides_rls.sql — Row-Level-Security tenant isolation for the EPIC-J
-- area-guide entities (master spec §J "Area guide", FR-J-1).
--
-- area_guides holds each tenant's managed area-guide pages (slug, name,
-- introduction, hero image, covered postcode prefixes, coordinates, SEO overrides,
-- status); area_guide_sections holds their page-builder blocks (the same structure
-- as page sections). Both are tenant-scoped and isolated with the same shape as
-- 0003/0005/.../0016/0018: ENABLE + FORCE RLS (so the table owner the app connects
-- as is also subject to it), with a tenant_isolation policy that admits a row only
-- when its tenant_id equals the per-request GUC `app.current_tenant_id`, set by the
-- client extension with SET LOCAL inside the request transaction. The GUC is
-- wrapped in NULLIF(..., '') before the ::uuid cast so an unscoped connection
-- yields NULL (no rows) rather than a cast error — graceful fail-closed.
--
-- The columns / FKs / unique + indexes are created by `prisma db push` from the
-- AreaGuide + AreaGuideSection models (a plain uuid/text/timestamp/array table is
-- Prisma-expressible) — this raw migration adds ONLY the RLS policies, which Prisma
-- cannot express. The isolation pattern is exercised against pglite in
-- src/area-guide.test.ts; full Prisma-against-PostgreSQL runs via Testcontainers in CI.

ALTER TABLE area_guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE area_guides FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON area_guides
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

ALTER TABLE area_guide_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE area_guide_sections FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON area_guide_sections
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
