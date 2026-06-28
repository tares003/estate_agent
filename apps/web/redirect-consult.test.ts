// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

// EPIC-O FR-O-11 — the proxy's redirect consult. Resolves an exact-path redirect rule
// for a tenant (inside the RLS scope), maps the stored type to an HTTP status, and
// best-effort bumps the hit counter. FAIL-OPEN: any error resolves to null / a no-op.
// withTenant is mocked to run the callback against a structural redirect client.

const findFirst = vi.fn();
const update = vi.fn();
const withTenant = vi.fn(async (_db: unknown, _tenant: string, fn: (tx: unknown) => unknown) =>
  fn({ redirect: { findFirst, update } }),
);
vi.mock('@estate/db', () => ({ withTenant }));

const { consultRedirect, bumpRedirectHit, redirectStatus } = await import('./redirect-consult.js');

const TENANT = '00000000-0000-0000-0000-000000000001';

describe('redirectStatus', () => {
  it('maps the stored RedirectType to its HTTP status', () => {
    expect(redirectStatus('r301')).toBe(301);
    expect(redirectStatus('r302')).toBe(302);
    expect(redirectStatus('r307')).toBe(307);
    expect(redirectStatus('gone')).toBe(410);
  });

  it('defaults an unknown type to a 301', () => {
    expect(redirectStatus('something-else')).toBe(301);
  });
});

describe('consultRedirect', () => {
  it('returns null when no rule matches', async () => {
    findFirst.mockResolvedValue(null);
    const db = { $transaction: vi.fn() };
    expect(await consultRedirect(db, TENANT, '/no-match')).toBeNull();
  });

  it('returns the matched destination + mapped status for an exact path', async () => {
    findFirst.mockResolvedValue({ id: 'r1', destinationPath: '/new', type: 'r302' });
    const db = { $transaction: vi.fn() };
    const match = await consultRedirect(db, TENANT, '/old');
    expect(match).toEqual({ id: 'r1', destinationPath: '/new', status: 302 });
    expect(findFirst.mock.calls[0]![0].where).toEqual({ sourcePath: '/old' });
  });

  it('fails open (returns null) when the lookup throws', async () => {
    withTenant.mockRejectedValueOnce(new Error('db down'));
    const db = { $transaction: vi.fn() };
    expect(await consultRedirect(db, TENANT, '/old')).toBeNull();
  });
});

describe('bumpRedirectHit', () => {
  it('increments the hit count and stamps last-hit', async () => {
    update.mockResolvedValue({});
    const db = { $transaction: vi.fn() };
    await bumpRedirectHit(db, TENANT, 'r1');
    const args = update.mock.calls[0]![0];
    expect(args.where).toEqual({ id: 'r1' });
    expect(args.data.hitCount).toEqual({ increment: 1 });
    expect(args.data.lastHitAt).toBeInstanceOf(Date);
  });

  it('fails open (no throw) when the bump throws', async () => {
    withTenant.mockRejectedValueOnce(new Error('db down'));
    const db = { $transaction: vi.fn() };
    await expect(bumpRedirectHit(db, TENANT, 'r1')).resolves.toBeUndefined();
  });
});
