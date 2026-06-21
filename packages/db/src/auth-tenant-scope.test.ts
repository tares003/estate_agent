import { describe, expect, it } from 'vitest';

import {
  AUTH_TENANT_MODELS,
  AuthTenantContextError,
  getAuthTenant,
  isAuthTenantModel,
  requireAuthTenant,
  runWithAuthTenant,
  scopeAuthArgs,
} from './auth-tenant-scope.js';

// B78a — the security core of the Better Auth runtime. Under per-tenant identity
// (users.@@unique([tenantId, email])) the auth adapter runs on a privileged
// BYPASSRLS connection, so isolation is NOT provided by RLS; it is provided HERE,
// by injecting `tenantId = <current tenant>` into every where/data better-auth
// issues, and by failing closed when no tenant context is set. These are pure
// unit tests of that injection + the request-scoped tenant store.

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';

describe('isAuthTenantModel', () => {
  it('recognises exactly the five better-auth adapter models', () => {
    for (const m of ['User', 'Session', 'Account', 'Verification', 'TwoFactor']) {
      expect(isAuthTenantModel(m)).toBe(true);
      expect(AUTH_TENANT_MODELS.has(m)).toBe(true);
    }
  });
  it('rejects every non-auth model (the auth connection must never touch tenant tables)', () => {
    for (const m of ['Property', 'Enquiry', 'AuditLog', 'PlatformTenant', 'Contractor', '']) {
      expect(isAuthTenantModel(m)).toBe(false);
    }
  });
});

describe('scopeAuthArgs — create/write paths stamp the tenant', () => {
  it('injects tenantId into create data and preserves the better-auth fields', () => {
    const out = scopeAuthArgs(
      'User',
      'create',
      { data: { email: 'a@x.com', name: 'A' } },
      TENANT_A,
    );
    expect(out.data).toEqual({ email: 'a@x.com', name: 'A', tenantId: TENANT_A });
  });
  it('injects tenantId into every row of createMany', () => {
    const out = scopeAuthArgs(
      'Account',
      'createMany',
      { data: [{ accountId: '1' }, { accountId: '2' }] },
      TENANT_A,
    );
    expect(out.data).toEqual([
      { accountId: '1', tenantId: TENANT_A },
      { accountId: '2', tenantId: TENANT_A },
    ]);
  });
  it('injects tenantId into a single-object createMany payload too', () => {
    const out = scopeAuthArgs('Account', 'createMany', { data: { accountId: '1' } }, TENANT_A);
    expect(out.data).toEqual({ accountId: '1', tenantId: TENANT_A });
  });
  it('upsert stamps both the where and the create branch', () => {
    const out = scopeAuthArgs(
      'Session',
      'upsert',
      { where: { token: 't' }, create: { token: 't' }, update: { expiresAt: 1 } },
      TENANT_A,
    );
    expect(out.where).toMatchObject({ token: 't', tenantId: TENANT_A });
    expect(out.create).toMatchObject({ token: 't', tenantId: TENANT_A });
    // update branch is NOT re-stamped (tenant never changes on an existing row)
    expect(out.update).toEqual({ expiresAt: 1 });
  });
});

describe('scopeAuthArgs — read/update/delete paths scope the where', () => {
  it('ANDs tenantId into a findFirst-by-email (the sign-in lookup)', () => {
    const out = scopeAuthArgs('User', 'findFirst', { where: { email: 'a@x.com' } }, TENANT_A);
    expect(out.where).toEqual({ email: 'a@x.com', tenantId: TENANT_A });
  });
  it('scopes the OAuth account lookup by (accountId, providerId) + tenant', () => {
    const out = scopeAuthArgs(
      'Account',
      'findFirst',
      { where: { accountId: 'g-123', providerId: 'google' } },
      TENANT_A,
    );
    expect(out.where).toEqual({ accountId: 'g-123', providerId: 'google', tenantId: TENANT_A });
  });
  it('adds a where when an operation arrives with none (count/findMany)', () => {
    expect(scopeAuthArgs('Verification', 'count', undefined, TENANT_A).where).toEqual({
      tenantId: TENANT_A,
    });
    expect(scopeAuthArgs('Verification', 'findMany', {}, TENANT_A).where).toEqual({
      tenantId: TENANT_A,
    });
  });
  it('scopes update/delete/updateMany/deleteMany by the where and leaves data alone', () => {
    const upd = scopeAuthArgs(
      'Session',
      'update',
      { where: { id: 's1' }, data: { x: 1 } },
      TENANT_A,
    );
    expect(upd.where).toEqual({ id: 's1', tenantId: TENANT_A });
    expect(upd.data).toEqual({ x: 1 });
    for (const op of ['delete', 'deleteMany', 'updateMany'] as const) {
      const out = scopeAuthArgs('Verification', op, { where: { identifier: 'e' } }, TENANT_A);
      expect(out.where).toEqual({ identifier: 'e', tenantId: TENANT_A });
    }
  });
});

describe('scopeAuthArgs — fails closed and is unspoofable', () => {
  it('the context tenant OVERRIDES any caller-supplied tenantId in a where', () => {
    const out = scopeAuthArgs('User', 'findFirst', { where: { tenantId: TENANT_B } }, TENANT_A);
    expect(out.where?.tenantId).toBe(TENANT_A);
  });
  it('the context tenant OVERRIDES any caller-supplied tenantId in create data', () => {
    const out = scopeAuthArgs('User', 'create', { data: { tenantId: TENANT_B } }, TENANT_A);
    expect((out.data as Record<string, unknown>).tenantId).toBe(TENANT_A);
  });
  it('throws when there is no tenant (empty / non-uuid) — never runs unscoped', () => {
    expect(() => scopeAuthArgs('User', 'findFirst', { where: {} }, '')).toThrow(
      AuthTenantContextError,
    );
    expect(() => scopeAuthArgs('User', 'findFirst', { where: {} }, 'not-a-uuid')).toThrow(
      AuthTenantContextError,
    );
  });
  it('does not mutate the caller-supplied args object', () => {
    const args = { where: { email: 'a@x.com' } };
    scopeAuthArgs('User', 'findFirst', args, TENANT_A);
    expect(args.where).toEqual({ email: 'a@x.com' });
  });
});

describe('request-scoped tenant store (AsyncLocalStorage)', () => {
  it('exposes the tenant inside runWithAuthTenant and nothing outside', () => {
    expect(getAuthTenant()).toBeUndefined();
    const seen = runWithAuthTenant(TENANT_A, () => getAuthTenant());
    expect(seen).toBe(TENANT_A);
    expect(getAuthTenant()).toBeUndefined();
  });
  it('requireAuthTenant throws outside a run and returns inside', () => {
    expect(() => requireAuthTenant()).toThrow(AuthTenantContextError);
    expect(runWithAuthTenant(TENANT_B, () => requireAuthTenant())).toBe(TENANT_B);
  });
  it('isolates concurrent tenants (no leakage across async contexts)', async () => {
    const run = (t: string) =>
      runWithAuthTenant(t, async () => {
        await new Promise((r) => setTimeout(r, 1));
        return getAuthTenant();
      });
    const [a, b] = await Promise.all([run(TENANT_A), run(TENANT_B)]);
    expect(a).toBe(TENANT_A);
    expect(b).toBe(TENANT_B);
  });
});
