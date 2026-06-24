// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { customerAuthLookup, type AuthSessionShape } from './customer-session-resolve.js';

// EPIC-T — the pure decision behind resolving a customer from a verified Better
// Auth session, mirroring staff-session-resolve.ts. A tenant-A cookie replayed on
// tenant-B's subdomain is rejected here rather than trusted (cross-tenant replay
// defence).

const TENANT_A = '00000000-0000-0000-0000-00000000000a';
const TENANT_B = '00000000-0000-0000-0000-00000000000b';

describe('customerAuthLookup', () => {
  it('returns the (userId, tenantId) for a session whose tenant matches the request', () => {
    const session: AuthSessionShape = {
      user: { id: 'c1', tenantId: TENANT_A },
      session: { tenantId: TENANT_A },
    };
    expect(customerAuthLookup(session, TENANT_A)).toEqual({ userId: 'c1', tenantId: TENANT_A });
  });

  it('rejects a null session', () => {
    expect(customerAuthLookup(null, TENANT_A)).toBeNull();
  });

  it('rejects a session with no user id', () => {
    expect(customerAuthLookup({ session: { tenantId: TENANT_A } }, TENANT_A)).toBeNull();
  });

  it('rejects a session whose tenant differs from the request tenant (replay defence)', () => {
    const session: AuthSessionShape = {
      user: { id: 'c1', tenantId: TENANT_A },
      session: { tenantId: TENANT_A },
    };
    expect(customerAuthLookup(session, TENANT_B)).toBeNull();
  });

  it('falls back to the user tenant when the session omits it, still tenant-matched', () => {
    const session: AuthSessionShape = { user: { id: 'c1', tenantId: TENANT_A } };
    expect(customerAuthLookup(session, TENANT_A)).toEqual({ userId: 'c1', tenantId: TENANT_A });
  });
});
