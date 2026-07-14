import { createPrismaClient, type PrismaClient } from '@estate/db';

// The shared Prisma client, cached on `globalThis` rather than in a module variable.
//
// A module-level `let` is NOT a singleton in Next dev: every hot reload re-evaluates the
// module, so the variable is re-declared as undefined and the next call constructs ANOTHER
// PrismaClient — while the previous one keeps its pooled connections open. Nothing closes
// them, so a dev session leaks a pool per reload until Postgres refuses everything with
// "FATAL: sorry, too many clients already" and every route 500s. (Observed live: after a
// long session the whole app went down, and even psql could no longer connect.)
//
// `globalThis` survives module re-evaluation, so ONE client is constructed and reused
// across reloads. In production the module is evaluated once in a long-lived process, so
// the two forms are equivalent there — this costs nothing and makes dev survivable.
//
// Still lazy: constructed on first CALL (request time, when DATABASE_URL is set), never at
// import/build time. Tenant isolation is applied per request via `withTenant` from
// @estate/db — this client is unscoped by design and must never be queried directly.

const globalForDb = globalThis as typeof globalThis & {
  __estatePrismaClient?: PrismaClient;
};

export function getDb(): PrismaClient {
  globalForDb.__estatePrismaClient ??= createPrismaClient();
  return globalForDb.__estatePrismaClient;
}
