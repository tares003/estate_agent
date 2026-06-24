// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import {
  customerSessionFromUser,
  loadCustomerSession,
  type CustomerUserReader,
  type CustomerUserRow,
} from './customer-user.js';

// EPIC-T — resolving a customer's session from their user record. Pure mapping +
// a structural read (DB-free to unit-test), mirroring the staff-user seam. Only a
// `type=customer` row resolves; a staff row (or no row) yields null so the customer
// gates can never honour a staff identity.

function customer(over: Partial<CustomerUserRow> = {}): CustomerUserRow {
  return {
    id: 'c1',
    type: 'customer',
    emailVerified: true,
    ...over,
  };
}

describe('customerSessionFromUser', () => {
  it('resolves the user id, the actor, and the verified-email flag', () => {
    expect(customerSessionFromUser(customer({ id: 'c9', emailVerified: true }))).toEqual({
      userId: 'c9',
      emailVerified: true,
      actor: 'customer:c9',
    });
  });

  it('carries an unverified-email flag through (FR-T-2 gate decides downstream)', () => {
    expect(customerSessionFromUser(customer({ emailVerified: false })).emailVerified).toBe(false);
  });

  it('treats a null email-verified column as not verified (fail-closed)', () => {
    expect(customerSessionFromUser(customer({ emailVerified: null })).emailVerified).toBe(false);
  });

  it('returns null for a non-customer (staff) user — never honour a staff identity', () => {
    expect(customerSessionFromUser(customer({ type: 'staff' }))).toBeNull();
  });
});

describe('loadCustomerSession', () => {
  function reader(row: CustomerUserRow | null): CustomerUserReader {
    return { user: { findFirst: vi.fn(async () => row) } };
  }

  it('returns the resolved session for an existing customer', async () => {
    const session = await loadCustomerSession(reader(customer()), 'c1');
    expect(session).toEqual({ userId: 'c1', emailVerified: true, actor: 'customer:c1' });
  });

  it('returns null when there is no such user in the tenant', async () => {
    expect(await loadCustomerSession(reader(null), 'missing')).toBeNull();
  });

  it('returns null when the matched user is staff (not a customer)', async () => {
    expect(await loadCustomerSession(reader(customer({ type: 'staff' })), 'c1')).toBeNull();
  });
});
