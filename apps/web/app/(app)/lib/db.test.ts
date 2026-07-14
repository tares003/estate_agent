import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The shared Prisma client must survive a Next dev HOT RELOAD.
//
// A module-level `let` is not a singleton across reloads: Next re-evaluates the module, the
// variable is re-declared as undefined, and the next call constructs ANOTHER PrismaClient
// while the previous one keeps its pooled connections open. Nothing closes them, so a dev
// session leaks a pool per reload until Postgres refuses every connection with "FATAL:
// sorry, too many clients already" and the whole app 500s — which is exactly what happened.
//
// `vi.resetModules()` re-evaluates the module the same way a hot reload does, so these
// tests reproduce the mechanism rather than merely asserting the current shape.

const createPrismaClient = vi.fn();
vi.mock('@estate/db', () => ({
  createPrismaClient: () => createPrismaClient(),
}));

const GLOBAL_KEY = '__estatePrismaClient';

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  delete (globalThis as Record<string, unknown>)[GLOBAL_KEY];
  createPrismaClient.mockImplementation(() => ({ id: createPrismaClient.mock.calls.length }));
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>)[GLOBAL_KEY];
});

describe('getDb', () => {
  it('constructs the client lazily — never at import time', async () => {
    await import('./db.js');
    // Importing the module must not open a connection: DATABASE_URL is a request-time
    // concern, and a build-time construction would break `next build`.
    expect(createPrismaClient).not.toHaveBeenCalled();
  });

  it('reuses one client across calls within a single module evaluation', async () => {
    const { getDb } = await import('./db.js');

    expect(getDb()).toBe(getDb());
    expect(createPrismaClient).toHaveBeenCalledTimes(1);
  });

  it('reuses the SAME client across a module re-evaluation (the hot-reload leak)', async () => {
    const first = (await import('./db.js')).getDb();

    // A hot reload: the module is evaluated afresh. A module-level `let` would be
    // undefined again here, and this second getDb() would construct a second client —
    // leaking the first one's connection pool. It must not.
    vi.resetModules();
    const second = (await import('./db.js')).getDb();

    expect(second).toBe(first);
    expect(createPrismaClient).toHaveBeenCalledTimes(1);
  });

  it('does not leak a pool per reload — 20 reloads still construct exactly one client', async () => {
    for (let reload = 0; reload < 20; reload += 1) {
      vi.resetModules();
      (await import('./db.js')).getDb();
    }

    // Before the fix this was 20 clients — 20 connection pools — against a Postgres
    // default of 100 max_connections.
    expect(createPrismaClient).toHaveBeenCalledTimes(1);
  });
});
