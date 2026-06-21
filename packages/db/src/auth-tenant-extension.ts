import { Prisma } from './client.js';
import {
  AuthTenantContextError,
  isAuthTenantModel,
  requireAuthTenant,
  scopeAuthArgs,
} from './auth-tenant-scope.js';

// B78a glue — binds the pure tenant-scoping injector (auth-tenant-scope.ts) into a
// live Prisma client via `Prisma.defineExtension`. The auth Prisma client (built in
// apps/web from AUTH_DATABASE_URL, a BYPASSRLS role) is `.$extends(...)`-ed with
// this so EVERY model operation better-auth's adapter issues is tenant-scoped
// before it reaches Postgres, and fails closed when no tenant is in context.
//
// This is connection glue: exercising it needs a live Prisma client (the extension
// machinery + a real query function), so it is covered by the Testcontainers
// integration tests (B78e), not the unit run — the same exclusion rationale as
// client.ts. All of its decision logic lives in scopeAuthArgs / requireAuthTenant /
// isAuthTenantModel, which ARE unit-tested.

/**
 * A Prisma client extension that tenant-scopes every operation against the five
 * better-auth adapter models and rejects any access to a non-auth model (the auth
 * connection bypasses RLS, so it must only ever touch its own, tenant-scoped
 * tables). Apply it to the auth client: `authClient.$extends(authTenantScopeExtension())`.
 */
export function authTenantScopeExtension() {
  return Prisma.defineExtension({
    name: 'auth-tenant-scope',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!isAuthTenantModel(model)) {
            throw new AuthTenantContextError(
              `The Better Auth connection must not touch the non-auth model "${model}".`,
            );
          }
          const tenantId = requireAuthTenant();
          const scoped = scopeAuthArgs(
            model,
            operation,
            args as Record<string, unknown> | undefined,
            tenantId,
          );
          return query(scoped as typeof args);
        },
      },
    },
  });
}
