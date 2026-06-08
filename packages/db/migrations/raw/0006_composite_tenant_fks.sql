-- 0006_composite_tenant_fks.sql — composite (tenant_id, <fk>) foreign keys that
-- enforce SAME-TENANT references at the database layer (audit finding D-012).
--
-- Postgres validates a foreign key with row-level security BYPASSED, so RLS
-- alone protects only the row being written, never the existence check of the
-- referenced parent. A user-supplied id (e.g. the hidden property_id on the
-- public enquiry form) could therefore link a child row — correctly created in
-- tenant A — to ANOTHER tenant's parent row. Putting tenant_id INTO the foreign
-- key closes the hole: the reference must match (tenant_id, id), so a
-- cross-tenant id finds no parent row and the write is rejected, RLS or not.
--
-- Prisma cannot express a composite FK to non-primary-key columns, so this is
-- raw SQL (CLAUDE.md §9). Each referenced parent gains a UNIQUE (tenant_id, id)
-- index (the FK target); each tenant-scoped child relation is re-pointed from
-- its single-column FK to the composite one, preserving the original ON DELETE
-- action from the Prisma schema.
--
-- ON DELETE for the NULLABLE relations uses the column-list form
-- `SET NULL (<fk>)` (PostgreSQL 15+) so deleting a parent nulls ONLY the fk
-- column and preserves the NOT NULL tenant_id (a plain SET NULL would try to
-- null tenant_id too and error). The non-nullable relations CASCADE-delete the
-- child as before. MATCH SIMPLE (the default) means a NULL fk column — a general
-- enquiry, an unassigned agent — skips the check entirely, as intended.
--
-- The DROP ... IF EXISTS lines remove the Prisma-generated single-column FKs by
-- their conventional `<table>_<column>_fkey` names; if a name differs the drop
-- is a harmless no-op and the (stricter) composite FK still governs writes.
-- tenant_id's own FK to platform_tenants (`<table>_tenant_id_fkey`) is left
-- intact — only the property_id / branch_id FKs are re-pointed.
--
-- Deliberately NOT hardened here: the optional SOFT references to agents —
-- notes.author_agent_id and property_status_events.changed_by_agent_id. These
-- carry no Prisma @relation by design (a note / status event must survive the
-- author agent leaving), and are set server-side from the acting session, never
-- from untrusted client input — so the D-012 user-supplied-id vector does not
-- apply. agents.user_id is likewise a soft column with no @relation. If any of
-- these ever becomes user-settable, validate its tenancy in the application
-- layer or add a matching composite FK (audit-report D-016).
--
-- Idempotent (IF EXISTS / IF NOT EXISTS + drop-before-add). Applied after
-- 0003/0005 (the tables + RLS exist). Verified on pglite (PG16) in
-- src/composite-tenant-fks.test.ts; the full apply against PostgreSQL runs via
-- Testcontainers in CI.

-- ── Parent unique targets (the columns each composite FK references) ──────────
CREATE UNIQUE INDEX IF NOT EXISTS branches_tenant_id_id_key   ON branches   (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS properties_tenant_id_id_key ON properties (tenant_id, id);

-- ── agents.branch_id → branches (branch_id nullable → SET NULL) ───────────────
ALTER TABLE agents DROP CONSTRAINT IF EXISTS agents_branch_id_fkey;
ALTER TABLE agents DROP CONSTRAINT IF EXISTS agents_tenant_branch_fkey;
ALTER TABLE agents ADD CONSTRAINT agents_tenant_branch_fkey
  FOREIGN KEY (tenant_id, branch_id) REFERENCES branches (tenant_id, id)
  ON UPDATE CASCADE ON DELETE SET NULL (branch_id);

-- ── properties.branch_id → branches (branch_id nullable → SET NULL) ───────────
ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_branch_id_fkey;
ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_tenant_branch_fkey;
ALTER TABLE properties ADD CONSTRAINT properties_tenant_branch_fkey
  FOREIGN KEY (tenant_id, branch_id) REFERENCES branches (tenant_id, id)
  ON UPDATE CASCADE ON DELETE SET NULL (branch_id);

-- ── enquiries.property_id → properties (property_id nullable → SET NULL) ──────
ALTER TABLE enquiries DROP CONSTRAINT IF EXISTS enquiries_property_id_fkey;
ALTER TABLE enquiries DROP CONSTRAINT IF EXISTS enquiries_tenant_property_fkey;
ALTER TABLE enquiries ADD CONSTRAINT enquiries_tenant_property_fkey
  FOREIGN KEY (tenant_id, property_id) REFERENCES properties (tenant_id, id)
  ON UPDATE CASCADE ON DELETE SET NULL (property_id);

-- ── repair_requests.property_id → properties (property_id nullable → SET NULL) ─
ALTER TABLE repair_requests DROP CONSTRAINT IF EXISTS repair_requests_property_id_fkey;
ALTER TABLE repair_requests DROP CONSTRAINT IF EXISTS repair_requests_tenant_property_fkey;
ALTER TABLE repair_requests ADD CONSTRAINT repair_requests_tenant_property_fkey
  FOREIGN KEY (tenant_id, property_id) REFERENCES properties (tenant_id, id)
  ON UPDATE CASCADE ON DELETE SET NULL (property_id);

-- ── viewings.property_id → properties (property_id NOT NULL → CASCADE) ────────
ALTER TABLE viewings DROP CONSTRAINT IF EXISTS viewings_property_id_fkey;
ALTER TABLE viewings DROP CONSTRAINT IF EXISTS viewings_tenant_property_fkey;
ALTER TABLE viewings ADD CONSTRAINT viewings_tenant_property_fkey
  FOREIGN KEY (tenant_id, property_id) REFERENCES properties (tenant_id, id)
  ON UPDATE CASCADE ON DELETE CASCADE;

-- ── property_images.property_id → properties (property_id NOT NULL → CASCADE) ─
ALTER TABLE property_images DROP CONSTRAINT IF EXISTS property_images_property_id_fkey;
ALTER TABLE property_images DROP CONSTRAINT IF EXISTS property_images_tenant_property_fkey;
ALTER TABLE property_images ADD CONSTRAINT property_images_tenant_property_fkey
  FOREIGN KEY (tenant_id, property_id) REFERENCES properties (tenant_id, id)
  ON UPDATE CASCADE ON DELETE CASCADE;

-- ── property_documents.property_id → properties (property_id NOT NULL → CASCADE)
ALTER TABLE property_documents DROP CONSTRAINT IF EXISTS property_documents_property_id_fkey;
ALTER TABLE property_documents DROP CONSTRAINT IF EXISTS property_documents_tenant_property_fkey;
ALTER TABLE property_documents ADD CONSTRAINT property_documents_tenant_property_fkey
  FOREIGN KEY (tenant_id, property_id) REFERENCES properties (tenant_id, id)
  ON UPDATE CASCADE ON DELETE CASCADE;

-- ── property_status_events.property_id → properties (NOT NULL → CASCADE) ──────
ALTER TABLE property_status_events DROP CONSTRAINT IF EXISTS property_status_events_property_id_fkey;
ALTER TABLE property_status_events DROP CONSTRAINT IF EXISTS property_status_events_tenant_property_fkey;
ALTER TABLE property_status_events ADD CONSTRAINT property_status_events_tenant_property_fkey
  FOREIGN KEY (tenant_id, property_id) REFERENCES properties (tenant_id, id)
  ON UPDATE CASCADE ON DELETE CASCADE;
