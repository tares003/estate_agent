-- 0012_better_auth_tables.sql — RLS posture for the EPIC-N Better Auth adapter
-- tables (sessions, accounts, verifications, two_factors).
--
-- The better-auth Prisma adapter reads and writes these rows BEFORE a session
-- exists — it is resolving the very session that would set the tenant GUC. Under
-- the standard tenant_isolation policy the GUC is still unset (NULL) at that
-- point, so NULLIF(...)::uuid yields NULL, every row is invisible, and sign-in,
-- magic-link verification and the OAuth callback would all fail closed with zero
-- rows. The auth layer therefore connects through a DEDICATED BYPASSRLS role
-- (AUTH_DATABASE_URL — see src/auth-tenant-scope.ts), exactly as the
-- operator-admin path does (CLAUDE.md §9); tenant scoping on that connection is
-- re-applied in app code, which injects tenant_id into every adapter operation
-- and fails closed when no tenant context is set.
--
-- This migration ENABLEs RLS on all four tables as defence in depth.
--
-- CORRECTION (see 0023_better_auth_rls_force.sql): this file originally skipped
-- FORCE + the policy on the reasoning that the table-owner exemption was the
-- intended privileged bypass for the auth adapter. That was inaccurate — the
-- adapter connects on a BYPASSRLS role, which is exempt from RLS whether or not
-- it is FORCEd, so the owner exemption only benefited the app's OWN base client
-- (the table owner): an accidental cross-tenant read path on high-sensitivity
-- session/token rows, not a required bypass. Note also that ALL FOUR tables carry
-- tenant_id stamped by the auth adapter (B78) — including verifications, whose
-- lookup-by-identifier must be tenant-scoped so two tenants can issue a link to
-- the same email. 0023 adds FORCE ROW LEVEL SECURITY + the standard GUC
-- tenant_isolation policy to all four, making the owner fail closed like every
-- other tenant table; the BYPASSRLS auth connection is unaffected.

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE two_factors ENABLE ROW LEVEL SECURITY;
