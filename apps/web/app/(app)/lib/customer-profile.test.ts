// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { getCustomerProfile, type CustomerProfileReader } from './customer-profile.js';

// EPIC-T FR-T-11 — the customer-profile read model. Pure query-shaping over a
// STRUCTURAL Prisma client (DB-free to unit-test, mirrors saved-searches.ts); the
// live query runs tenant-scoped (RLS) + user-scoped via withTenant in the
// /account/profile route. Scoped to the customer's OWN row and to type=customer.

const USER = 'c1';

function reader(row: unknown): {
  r: CustomerProfileReader;
  findFirst: ReturnType<typeof vi.fn>;
} {
  const findFirst = vi.fn(async () => row);
  return {
    r: { user: { findFirst } } as unknown as CustomerProfileReader,
    findFirst,
  };
}

describe('getCustomerProfile', () => {
  it('returns the editable profile fields, scoped to the customer own row', async () => {
    const { r, findFirst } = reader({
      name: 'Albert Aardvark',
      phone: '07911 123456',
      contactByEmail: true,
      contactBySms: false,
      marketingOptIn: true,
    });

    const profile = await getCustomerProfile(r, USER);

    expect(profile).toEqual({
      name: 'Albert Aardvark',
      phone: '07911 123456',
      contactByEmail: true,
      contactBySms: false,
      marketingOptIn: true,
    });
    // Scoped to the acting customer's own id AND to a customer-type row.
    expect(findFirst.mock.calls[0]![0]).toMatchObject({
      where: { id: USER, type: 'customer' },
    });
  });

  it('carries a null phone through unchanged (no phone set)', async () => {
    const { r } = reader({
      name: 'Beatrix',
      phone: null,
      contactByEmail: true,
      contactBySms: false,
      marketingOptIn: false,
    });
    const profile = await getCustomerProfile(r, USER);
    expect(profile?.phone).toBeNull();
  });

  it('returns null when no such customer row exists', async () => {
    const { r } = reader(null);
    expect(await getCustomerProfile(r, USER)).toBeNull();
  });
});
