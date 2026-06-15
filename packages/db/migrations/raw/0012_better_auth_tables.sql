-- 0012_better_auth_tables.sql — RLS posture for the EPIC-N Better Auth adapter
-- tables (sessions, accounts, verifications, two_factors).
--
-- THESE TABLES ARE A DELIBERATE RLS EXCEPTION. Every other tenant-owned table is
-- under the tenant_isolation FORCE-RLS policy of 0002/0003/0005/0007-0011, keyed
-- on the per-request GUC `app.current_tenant_id`. The auth tables are NOT, and
-- must not be:
--
--   * The better-auth Prisma adapter reads and writes these rows BEFORE a session
--     exists — it is resolving the very session that would set the tenant GUC.
--     Under the standard policy the GUC is still unset (NULL) at that point, so
--     NULLIF(...)::uuid yields NULL, every row is invisible, and sign-in,
--     magic-link verification and the OAuth callback all fail closed with zero
--     rows. The exception is required for the auth layer to function at all.
--
-- Isolation is instead enforced two ways:
--   1. Structurally — sessions, accounts and two_factors each chain to a users row
--      via user_id, and users is itself tenant-scoped under 0002's policy. A
--      session/account/2FA row is only ever reachable through its tenant's user.
--      verifications is a short-lived pre-user token store (identifier + value)
--      that precedes any user, so it carries no tenant.
--   2. By connection — the auth layer connects through a privileged role that
--      bypasses RLS, exactly as the operator-admin path does (CLAUDE.md §9).
--
-- We still ENABLE RLS on all four as defence in depth: with RLS enabled and NO
-- permissive policy attached, only a BYPASSRLS/owner role can see rows — precisely
-- the privileged auth connection. We deliberately do NOT FORCE RLS here (unlike
-- the tenant tables), so the owning role the auth adapter connects as is exempt;
-- that exemption IS the intended privileged bypass.
--
-- The tables are DORMANT until the route mount (B78) constructs the Better Auth
-- instance against the database; nothing reads or writes them yet.

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE two_factors ENABLE ROW LEVEL SECURITY;
