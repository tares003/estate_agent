import { createPrismaClient, type PrismaClient } from '@estate/db';

let client: PrismaClient | undefined;

/**
 * Lazily-constructed shared Prisma client. Constructed on first call (request
 * time, when DATABASE_URL is set) — never at import/build time. Tenant isolation
 * is applied per request via `withTenant` from @estate/db.
 */
export function getDb(): PrismaClient {
  client ??= createPrismaClient();
  return client;
}
