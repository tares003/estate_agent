-- 0023_better_auth_rls_force.sql — FORCE Row-Level Security + the standard GUC
-- tenant_isolation policy on the EPIC-N Better Auth adapter tables (sessions,
-- accounts, verifications, two_factors). Closes audit finding
-- auth-tables-rls-not-forced-isolation-by-convention (deep-audit-2026-07-09).
--
-- 0012 ENABLEd RLS on these four tables but deliberately skipped FORCE and the
-- policy, reasoning that the table-owner exemption was the auth layer's intended
-- privileged bypass. The shipped design superseded that reasoning: the Better
-- Auth adapter connects through a DEDICATED BYPASSRLS role (AUTH_DATABASE_URL —
-- see packages/db/src/auth-tenant-scope.ts), and BYPASSRLS is exempt from RLS
-- whether or not it is FORCEd. The owner exemption therefore protected nothing
-- and instead left a trap: the app's base Prisma client connects AS the table
-- owner, so a single un-scoped query against these tables would have silently
-- returned every tenant's session/token rows.
--
-- This migration makes the owner fail closed, the same shape as every other
-- tenant table (0002/0003/0005/0007-0011/0013-0022). ENABLE was already applied
-- by 0012; FORCE + the policy land here:
--
--   * the base client (owner) sees only rows whose tenant_id equals the
--     per-request GUC `app.current_tenant_id`, set by the client extension with
--     SET LOCAL inside the request transaction. The GUC is wrapped in
--     NULLIF(..., '') before the ::uuid cast so an unscoped connection yields
--     NULL (no rows) rather than a cast error — graceful fail-closed;
--   * the auth adapter is unaffected: its BYPASSRLS role bypasses both the
--     policy and FORCE, so the pre-session reads/writes (sign-in, magic-link
--     verification, the OAuth callback) keep working exactly as before.
--
-- All four tables carry tenant_id (stamped by the auth adapter / B78; asserted
-- by src/auth-schema.test.ts), so the standard policy applies to each. The
-- owner-fail-closed / privileged-bypass pattern is exercised against pglite in
-- src/auth-rls-force.test.ts.

ALTER TABLE sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON sessions
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

ALTER TABLE accounts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON accounts
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

ALTER TABLE verifications FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON verifications
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

ALTER TABLE two_factors FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON two_factors
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
