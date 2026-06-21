-- 0013_auth_tenant_columns.sql — per-tenant scoping columns for the Better Auth
-- adapter tables (accounts, verifications, two_factors).
--
-- WHY (B78): identity is PER-TENANT (users.@@unique([tenant_id, email])), so an
-- email — and an OAuth provider account, and a magic-link identifier — is unique
-- only WITHIN a tenant, never globally. better-auth's adapter resolves users and
-- accounts by those non-unique keys (findFirst on email; findFirst on
-- account_id+provider_id; findMany on verification identifier). The auth adapter
-- runs through a privileged BYPASSRLS connection (it must read `users` before any
-- session/tenant GUC exists — see 0012), so RLS does NOT scope these reads. The
-- tenant boundary is therefore re-imposed at the app layer: a Prisma $extends hook
-- injects `tenant_id = <current tenant>` into EVERY where/data for the auth models
-- and fails closed when no tenant context is set. That where-injection is the
-- isolation boundary; for it to bind, accounts/verifications/two_factors need a
-- tenant_id column (users + sessions already have one).
--
-- These columns are NOT NULL: the tables are dormant (zero rows) until B78 mounts
-- the auth route, and the adapter stamps tenant_id on every insert, so there is no
-- backfill. No tenant_isolation RLS policy is attached (the 0012 exception stands —
-- the adapter's connection bypasses RLS); the column exists purely so the
-- app-layer where-injection can scope by it. Indexed for the per-tenant lookups.

ALTER TABLE accounts ADD COLUMN tenant_id uuid NOT NULL;
ALTER TABLE verifications ADD COLUMN tenant_id uuid NOT NULL;
ALTER TABLE two_factors ADD COLUMN tenant_id uuid NOT NULL;

CREATE INDEX accounts_tenant_id_idx ON accounts (tenant_id);
CREATE INDEX verifications_tenant_id_idx ON verifications (tenant_id);
CREATE INDEX two_factors_tenant_id_idx ON two_factors (tenant_id);
