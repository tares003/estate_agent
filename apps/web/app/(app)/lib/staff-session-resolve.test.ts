import { describe, expect, it } from 'vitest';

import { staffAuthLookup } from './staff-session-resolve.js';

// B78d — the pure decision behind resolving a staff member from a verified Better
// Auth session. The session carries the user id + the tenant it was issued for; we
// only accept it when that tenant matches the tenant the request's HOSTNAME
// resolved to (the EPIC-S middleware). That match is the belt to the adapter's
// braces: better-auth's cookie-cache can return a session straight from the signed
// cookie WITHOUT a DB read, so a tenant-A cookie replayed on tenant-B's subdomain
// must be rejected HERE (the B78a adversarial-review requirement).

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';
const USER = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

describe('staffAuthLookup', () => {
  it('returns null when there is no session', () => {
    expect(staffAuthLookup(null, TENANT_A)).toBeNull();
  });

  it('accepts a session whose tenant matches the request tenant', () => {
    const out = staffAuthLookup(
      { user: { id: USER, tenantId: TENANT_A }, session: { tenantId: TENANT_A } },
      TENANT_A,
    );
    expect(out).toEqual({ userId: USER, tenantId: TENANT_A });
  });

  it('prefers the session tenantId and still requires it to match', () => {
    // session.tenantId is the authoritative additionalField the cookie carries.
    const out = staffAuthLookup(
      { user: { id: USER, tenantId: TENANT_B }, session: { tenantId: TENANT_A } },
      TENANT_A,
    );
    expect(out).toEqual({ userId: USER, tenantId: TENANT_A });
  });

  it('falls back to the user tenantId when the session has none', () => {
    const out = staffAuthLookup({ user: { id: USER, tenantId: TENANT_A }, session: {} }, TENANT_A);
    expect(out).toEqual({ userId: USER, tenantId: TENANT_A });
  });

  it('REJECTS a session whose tenant differs from the request tenant (cross-tenant replay)', () => {
    expect(
      staffAuthLookup(
        { user: { id: USER, tenantId: TENANT_A }, session: { tenantId: TENANT_A } },
        TENANT_B,
      ),
    ).toBeNull();
  });

  it('returns null when the session names no user', () => {
    expect(staffAuthLookup({ user: null, session: { tenantId: TENANT_A } }, TENANT_A)).toBeNull();
    expect(
      staffAuthLookup({ user: { id: '' }, session: { tenantId: TENANT_A } }, TENANT_A),
    ).toBeNull();
  });

  it('returns null when the session names no tenant at all', () => {
    expect(staffAuthLookup({ user: { id: USER }, session: {} }, TENANT_A)).toBeNull();
  });
});
