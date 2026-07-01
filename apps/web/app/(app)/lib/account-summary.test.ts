// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { getAccountSummary, type AccountSummaryReader } from './account-summary.js';

// EPIC-T (master spec §C.17) — the account-dashboard summary read model. Pure
// query-shaping over a STRUCTURAL Prisma client (DB-free to unit-test, mirrors
// saved-searches.test.ts). Tenant scoping is applied by the caller (withTenant);
// this just shapes the name read + the two count reads, all scoped to the user.

const USER = 'c1';

function reader(opts: {
  user?: { name: string } | null;
  savedProperties?: number;
  savedSearches?: number;
}): {
  r: AccountSummaryReader;
  findFirst: ReturnType<typeof vi.fn>;
  savedPropertyCount: ReturnType<typeof vi.fn>;
  savedSearchCount: ReturnType<typeof vi.fn>;
} {
  const findFirst = vi
    .fn()
    .mockResolvedValue(opts.user === undefined ? { name: 'Ada' } : opts.user);
  const savedPropertyCount = vi.fn().mockResolvedValue(opts.savedProperties ?? 0);
  const savedSearchCount = vi.fn().mockResolvedValue(opts.savedSearches ?? 0);
  return {
    r: {
      user: { findFirst },
      savedProperty: { count: savedPropertyCount },
      savedSearch: { count: savedSearchCount },
    } as unknown as AccountSummaryReader,
    findFirst,
    savedPropertyCount,
    savedSearchCount,
  };
}

describe('getAccountSummary', () => {
  it('returns the customer name and the two saved counts', async () => {
    const { r } = reader({ user: { name: 'Ada Lovelace' }, savedProperties: 4, savedSearches: 2 });
    const summary = await getAccountSummary(r, USER);
    expect(summary).toEqual({
      name: 'Ada Lovelace',
      savedPropertiesCount: 4,
      savedSearchesCount: 2,
    });
  });

  it('scopes the name read to the user and to type=customer', async () => {
    const { r, findFirst } = reader({ user: { name: 'Ada' } });
    await getAccountSummary(r, USER);
    expect(findFirst.mock.calls[0]![0]).toMatchObject({
      where: { id: USER, type: 'customer' },
      select: { name: true },
    });
  });

  it('scopes each count read to the acting user', async () => {
    const { r, savedPropertyCount, savedSearchCount } = reader({});
    await getAccountSummary(r, USER);
    expect(savedPropertyCount.mock.calls[0]![0]).toEqual({ where: { userId: USER } });
    expect(savedSearchCount.mock.calls[0]![0]).toEqual({ where: { userId: USER } });
  });

  it('yields a null name (not a throw) when the user row is gone, counts still resolve', async () => {
    const { r } = reader({ user: null, savedProperties: 1, savedSearches: 0 });
    const summary = await getAccountSummary(r, USER);
    expect(summary.name).toBeNull();
    expect(summary.savedPropertiesCount).toBe(1);
    expect(summary.savedSearchesCount).toBe(0);
  });
});
