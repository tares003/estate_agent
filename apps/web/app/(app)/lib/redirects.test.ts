import { describe, expect, it, vi } from 'vitest';

import { findActiveRedirect, listRedirects, type RedirectReader } from './redirects.js';

// EPIC-O FR-O-11 — the redirect-rules read model. `listRedirects` shapes the admin
// table query (newest first); `findActiveRedirect` is the exact-path lookup the proxy
// consults. Tenant scoping is applied by the caller (withTenant); these just shape the
// queries + pass rows through.

function reader(): {
  r: RedirectReader;
  findMany: ReturnType<typeof vi.fn>;
  findFirst: ReturnType<typeof vi.fn>;
} {
  const findMany = vi.fn().mockResolvedValue([]);
  const findFirst = vi.fn().mockResolvedValue(null);
  return {
    r: { redirect: { findMany, findFirst } } as unknown as RedirectReader,
    findMany,
    findFirst,
  };
}

describe('listRedirects', () => {
  it('orders by created-at descending (newest first)', async () => {
    const { r, findMany } = reader();
    await listRedirects(r);
    expect(findMany.mock.calls[0]![0].orderBy).toEqual({ createdAt: 'desc' });
  });

  it('returns the rows from the reader', async () => {
    const rows = [
      {
        id: 'r1',
        sourcePath: '/old',
        destinationPath: '/new',
        type: 'r301',
        hitCount: 3,
        lastHitAt: null,
      },
    ];
    const { r, findMany } = reader();
    findMany.mockResolvedValue(rows);
    expect(await listRedirects(r)).toEqual(rows);
  });
});

describe('findActiveRedirect', () => {
  it('looks up an exact source-path match and selects only the proxy fields', async () => {
    const { r, findFirst } = reader();
    await findActiveRedirect(r, '/old-path');
    const args = findFirst.mock.calls[0]![0];
    expect(args.where).toEqual({ sourcePath: '/old-path' });
    expect(args.select).toEqual({ id: true, destinationPath: true, type: true });
  });

  it('returns the matched redirect', async () => {
    const match = { id: 'r1', destinationPath: '/new-path', type: 'r301' };
    const { r, findFirst } = reader();
    findFirst.mockResolvedValue(match);
    expect(await findActiveRedirect(r, '/old-path')).toEqual(match);
  });

  it('returns null when there is no matching rule', async () => {
    const { r } = reader();
    expect(await findActiveRedirect(r, '/no-match')).toBeNull();
  });
});
