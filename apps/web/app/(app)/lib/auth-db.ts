import { PrismaClient, authTenantScopeExtension } from '@estate/db';

// B78b glue — the Prisma client the Better Auth adapter connects through.
//
// It is a SEPARATE client from the app's request client (lib/db.ts): the auth
// adapter must read `users` BEFORE any session/tenant GUC exists, so it connects
// as a privileged role that bypasses RLS via `AUTH_DATABASE_URL` (a BYPASSRLS
// Postgres role — see migrations/raw/0012). Because RLS does not isolate that
// connection, the client is wrapped with `authTenantScopeExtension()`, which
// injects `tenant_id = <current tenant>` into every auth-model query and FAILS
// CLOSED when no tenant is in context (packages/db/auth-tenant-scope.ts). The
// current tenant is supplied per request by runWithAuthTenant() in the route
// mount (B78c) and the staff-session reader (B78d).
//
// Connection glue — constructed lazily at first use (never at build time) and
// excluded from unit coverage (it needs a live BYPASSRLS DB); its behaviour is
// verified by the Testcontainers integration tests (B78e).

type AuthDb = ReturnType<PrismaClient['$extends']>;

let client: AuthDb | undefined;

/** The BYPASSRLS, tenant-scoped Prisma client for the Better Auth adapter. */
export function getAuthDb(): AuthDb {
  if (client) return client;
  const url = process.env['AUTH_DATABASE_URL'];
  if (!url) {
    throw new Error(
      'AUTH_DATABASE_URL is not set — the Better Auth adapter needs a privileged ' +
        '(BYPASSRLS) connection string distinct from DATABASE_URL.',
    );
  }
  client = new PrismaClient({ datasources: { db: { url } } }).$extends(authTenantScopeExtension());
  return client;
}
