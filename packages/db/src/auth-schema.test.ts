import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

// EPIC-N Better Auth foundation (CLAUDE.md §9, FR-N-*). The auth schema is the
// `better-auth@1.6.15` adapter contract: the Prisma model FIELD names must be the
// exact camelCase identifiers better-auth reads/writes (the @map column names are
// free — Prisma maps them; better-auth never sees a column name). Generated from
// the installed package's own getAuthTables (not guessed). Decisions (this PR's
// questions): identity is PER-TENANT (User keeps @@unique([tenantId, email])); the
// existing `users` table is EXTENDED to be better-auth's user. Schema-only unit —
// asserts the schema source + the 0012 migration text.

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const schema = readFileSync(join(root, 'prisma', 'schema.prisma'), 'utf8');
const rls = readFileSync(join(root, 'migrations', 'raw', '0012_better_auth_tables.sql'), 'utf8');

function model(name: string): string {
  const match = schema.match(new RegExp(`model ${name} \\{[\\s\\S]*?\\n\\}`, 'm'));
  expect(match, `model ${name} should be declared`).not.toBeNull();
  return match![0];
}

describe('User — extended for Better Auth (identity = per-tenant)', () => {
  const user = model('User');
  it('keeps the per-tenant email uniqueness (decision: per-tenant identity)', () => {
    expect(user).toMatch(/@@unique\(\[tenantId, email\]\)/);
  });
  it('adds the better-auth user columns (field names exact; columns @mapped)', () => {
    expect(user).toMatch(/emailVerified\s+Boolean\s+@default\(false\)\s+@map\("email_verified"\)/);
    expect(user).toMatch(/image\s+String\?/);
    expect(user).toMatch(/twoFactorEnabled\s+Boolean\?\s+@map\("two_factor_enabled"\)/);
  });
  it('relates to its sessions, accounts and two-factor rows', () => {
    expect(user).toMatch(/sessions\s+Session\[\]/);
    expect(user).toMatch(/accounts\s+Account\[\]/);
    expect(user).toMatch(/twoFactors\s+TwoFactor\[\]/);
  });
});

describe('Session — better-auth session (prisma.session)', () => {
  const session = model('Session');
  it('carries the exact better-auth fields + the tenantId additional field', () => {
    expect(session).toMatch(/token\s+String\s+@unique/);
    expect(session).toMatch(/expiresAt\s+DateTime\s+@map\("expires_at"\)/);
    expect(session).toMatch(/ipAddress\s+String\?\s+@map\("ip_address"\)/);
    expect(session).toMatch(/userAgent\s+String\?\s+@map\("user_agent"\)/);
    expect(session).toMatch(/userId\s+String\s+@map\("user_id"\)/);
    expect(session).toMatch(/tenantId\s+String\s+@map\("tenant_id"\)/);
    expect(session).toMatch(/user\s+User\s+@relation/);
    expect(session).toContain('@@map("sessions")');
  });
});

describe('Account — better-auth OAuth/password links (prisma.account)', () => {
  const account = model('Account');
  it('carries the provider + token fields better-auth writes', () => {
    expect(account).toMatch(/accountId\s+String\s+@map\("account_id"\)/);
    expect(account).toMatch(/providerId\s+String\s+@map\("provider_id"\)/);
    expect(account).toMatch(/accessToken\s+String\?\s+@map\("access_token"\)/);
    expect(account).toMatch(/idToken\s+String\?\s+@map\("id_token"\)/);
    expect(account).toMatch(/password\s+String\?/);
    expect(account).toMatch(/userId\s+String\s+@map\("user_id"\)/);
    expect(account).toContain('@@map("accounts")');
  });
  it('carries tenantId so the auth adapter scopes OAuth/credential links per-tenant (B78)', () => {
    // An OAuth account is found by (accountId, providerId); under per-tenant
    // identity the same provider account can exist once per tenant, so the read
    // MUST be tenant-scoped or sign-in could resolve the wrong tenant's user.
    expect(account).toMatch(/tenantId\s+String\s+@map\("tenant_id"\)/);
  });
  it('relates tenantId to PlatformTenant (cascade — DB-layer defence in depth)', () => {
    expect(account).toMatch(/tenant\s+PlatformTenant\s+@relation\(fields: \[tenantId\]/);
  });
});

describe('Verification + TwoFactor', () => {
  it('Verification carries identifier/value/expiresAt (magic-link + email verify)', () => {
    const v = model('Verification');
    expect(v).toMatch(/identifier\s+String/);
    expect(v).toMatch(/value\s+String/);
    expect(v).toMatch(/expiresAt\s+DateTime\s+@map\("expires_at"\)/);
    expect(v).toContain('@@map("verifications")');
  });
  it('Verification carries tenantId so magic-link tokens cannot be consumed cross-tenant (B78)', () => {
    // A verification is found by `identifier` (the email/key); two tenants can
    // issue a link to the same email, so consumption MUST be tenant-scoped. The
    // tenant FK also gives a cleanup path on tenant deletion (no user chain here).
    const v = model('Verification');
    expect(v).toMatch(/tenantId\s+String\s+@map\("tenant_id"\)/);
    expect(v).toMatch(/tenant\s+PlatformTenant\s+@relation\(fields: \[tenantId\]/);
  });
  it('TwoFactor carries the TOTP secret + backup codes + userId (FR-N-2)', () => {
    const t = model('TwoFactor');
    expect(t).toMatch(/secret\s+String/);
    expect(t).toMatch(/backupCodes\s+String\s+@map\("backup_codes"\)/);
    expect(t).toMatch(/userId\s+String\s+@map\("user_id"\)/);
    expect(t).toContain('@@map("two_factors")');
  });
  it('TwoFactor carries tenantId + the PlatformTenant FK for uniform adapter scoping (B78)', () => {
    const t = model('TwoFactor');
    expect(t).toMatch(/tenantId\s+String\s+@map\("tenant_id"\)/);
    expect(t).toMatch(/tenant\s+PlatformTenant\s+@relation\(fields: \[tenantId\]/);
  });
});

describe('0012 migration — auth-layer RLS exception (documented)', () => {
  it('explains why the auth tables are NOT under the per-request tenant GUC policy', () => {
    // The adapter runs BEFORE a session exists, so the standard tenant_isolation
    // FORCE-RLS would return zero rows and break sign-in. Isolation is structural
    // (userId → user) + a privileged auth connection (the operator-path pattern).
    expect(rls).toMatch(/pre-session|before a session|privileged|bypass/i);
    expect(rls).toContain('sessions');
    expect(rls).toContain('accounts');
  });
});

describe('auth-table tenant scoping — schema-origin (no raw ADD COLUMN migration)', () => {
  it('PlatformTenant back-relates to every auth table (cascade cleanup on tenant delete)', () => {
    const t = model('PlatformTenant');
    expect(t).toMatch(/sessions\s+Session\[\]/);
    expect(t).toMatch(/accounts\s+Account\[\]/);
    expect(t).toMatch(/verifications\s+Verification\[\]/);
    expect(t).toMatch(/twoFactors\s+TwoFactor\[\]/);
  });
  it('Session also relates tenantId to PlatformTenant', () => {
    expect(model('Session')).toMatch(/tenant\s+PlatformTenant\s+@relation\(fields: \[tenantId\]/);
  });
});
