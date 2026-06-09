// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  TENANT_HEADER,
  getTenantFromReq,
  stampTenant,
  tenantCreateAccess,
  tenantScopedAccess,
} from './tenant.js';

// EPIC-D / EPIC-S: Payload runs its own DB connection (Drizzle), so the Prisma
// tenant-RLS extension does NOT apply to Payload's tables. Tenant isolation for
// the payload-schema collections is enforced at the app layer by these access
// functions, which read the x-estate-tenant header the proxy resolves. The
// trustworthiness of that header (hostname-derived, not client-forgeable) is
// EPIC-S's responsibility; this module consumes the resolved value, fail-closed.

const TENANT_A = '11111111-1111-1111-1111-111111111111';

function reqWith(headers: Record<string, string>, user?: unknown) {
  return { headers: new Headers(headers), user: user ?? null };
}

describe('getTenantFromReq', () => {
  it('returns the x-estate-tenant header value', () => {
    expect(getTenantFromReq(reqWith({ [TENANT_HEADER]: TENANT_A }) as never)).toBe(TENANT_A);
  });

  it('returns null when the header is absent or empty', () => {
    expect(getTenantFromReq(reqWith({}) as never)).toBeNull();
    expect(getTenantFromReq(reqWith({ [TENANT_HEADER]: '' }) as never)).toBeNull();
  });
});

describe('tenantScopedAccess (read / update / delete)', () => {
  it('constrains to the resolved tenant via a Where filter', () => {
    const result = tenantScopedAccess({ req: reqWith({ [TENANT_HEADER]: TENANT_A }) } as never);
    expect(result).toEqual({ tenant: { equals: TENANT_A } });
  });

  it('fails closed (denies) when no tenant is resolved', () => {
    expect(tenantScopedAccess({ req: reqWith({}) } as never)).toBe(false);
  });
});

describe('tenantCreateAccess', () => {
  it('allows an authenticated editor with a resolved tenant', () => {
    const req = reqWith({ [TENANT_HEADER]: TENANT_A }, { id: 'editor-1' });
    expect(tenantCreateAccess({ req } as never)).toBe(true);
  });

  it('denies an unauthenticated request even with a tenant', () => {
    expect(tenantCreateAccess({ req: reqWith({ [TENANT_HEADER]: TENANT_A }) } as never)).toBe(
      false,
    );
  });

  it('denies an authenticated request with no resolved tenant', () => {
    expect(tenantCreateAccess({ req: reqWith({}, { id: 'editor-1' }) } as never)).toBe(false);
  });
});

describe('stampTenant field hook', () => {
  it('stamps the request tenant on create', () => {
    const out = stampTenant({
      req: reqWith({ [TENANT_HEADER]: TENANT_A }),
      operation: 'create',
      value: undefined,
    } as never);
    expect(out).toBe(TENANT_A);
  });

  it('is immutable on update — keeps the existing value, ignoring the header', () => {
    const out = stampTenant({
      req: reqWith({ [TENANT_HEADER]: 'a-different-tenant' }),
      operation: 'update',
      value: TENANT_A,
    } as never);
    expect(out).toBe(TENANT_A);
  });
});
