import { AsyncLocalStorage } from 'node:async_hooks';

// B78a — the security core of the Better Auth runtime (CLAUDE.md §9, EPIC-N).
//
// Identity is PER-TENANT: an email, an OAuth provider account and a magic-link
// identifier are unique only WITHIN a tenant. better-auth's Prisma adapter resolves
// users/accounts/verifications by those non-unique keys, and it must read `users`
// BEFORE any session exists — so it runs on a privileged BYPASSRLS connection
// (migrations/raw/0012 + 0013) where RLS does NOT scope the reads. The tenant
// boundary is therefore re-imposed HERE, in application code, by:
//   1. injecting `tenantId = <current tenant>` into every where/data the adapter
//      issues against the five auth models, and
//   2. failing closed — throwing — when no tenant context is set, so a missing
//      context can never run an unscoped query on the bypass connection.
// The current tenant is carried per request in an AsyncLocalStorage, set from the
// request hostname by the route mount + the staff-session reader (B78c/B78d).
//
// This module is PURE (no Prisma import): `scopeAuthArgs` is the injector and is
// unit-tested exhaustively. The thin glue that binds it into a live Prisma client
// (`Prisma.defineExtension`) lives in auth-tenant-extension.ts.

/** The five better-auth adapter models (Prisma model names). Every one carries a
 * `tenantId` column; the auth connection must touch no other model. */
export const AUTH_TENANT_MODELS: ReadonlySet<string> = new Set([
  'User',
  'Session',
  'Account',
  'Verification',
  'TwoFactor',
]);

/** True when `model` is one of the tenant-scoped better-auth adapter models. */
export function isAuthTenantModel(model: string): boolean {
  return AUTH_TENANT_MODELS.has(model);
}

/** Thrown when an auth query would run without a resolved tenant — fail-closed. */
export class AuthTenantContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthTenantContextError';
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Prisma write operations that carry a `data` payload to stamp the tenant onto.
const CREATE_OP = 'create';
const CREATE_MANY_OPS: ReadonlySet<string> = new Set(['createMany', 'createManyAndReturn']);
const UPSERT_OP = 'upsert';

/** The shape `scopeAuthArgs` reads and returns — a superset of every Prisma
 * operation's args (the index signature keeps `select`, `orderBy`, etc. intact). */
export interface ScopedAuthArgs {
  where?: Record<string, unknown>;
  data?: Record<string, unknown> | Record<string, unknown>[];
  create?: Record<string, unknown>;
  update?: Record<string, unknown>;
  [key: string]: unknown;
}

function withTenant(
  record: Record<string, unknown> | undefined,
  tenantId: string,
): Record<string, unknown> {
  // Spread first, then set tenantId LAST so the context value always wins over any
  // caller-supplied tenantId — the boundary is unspoofable from better-auth's args.
  return { ...(record ?? {}), tenantId };
}

/**
 * Return a copy of `args` with the current tenant injected so the query is scoped
 * to that tenant. Reads/updates/deletes get `tenantId` ANDed into their `where`;
 * creates get it stamped into their `data`; upsert gets both. The input is never
 * mutated. Throws {@link AuthTenantContextError} when `tenantId` is not a UUID, so
 * no auth query ever runs unscoped on the bypass connection.
 *
 * @param model Prisma model name (assumed already checked with {@link isAuthTenantModel}).
 * @param operation Prisma client operation (`findFirst`, `create`, `updateMany`, …).
 * @param args The operation arguments better-auth's adapter built.
 * @param tenantId The current request's tenant (a UUID).
 */
export function scopeAuthArgs(
  model: string,
  operation: string,
  args: Record<string, unknown> | undefined,
  tenantId: string,
): ScopedAuthArgs {
  if (!tenantId || !UUID_RE.test(tenantId)) {
    throw new AuthTenantContextError(
      `Refusing to run a "${operation}" on auth model "${model}" with no resolved tenant — ` +
        'the auth adapter connection bypasses RLS, so a missing tenant must fail closed.',
    );
  }
  const next: ScopedAuthArgs = { ...(args ?? {}) };

  if (operation === CREATE_OP) {
    next.data = withTenant(next.data as Record<string, unknown> | undefined, tenantId);
    return next;
  }
  if (CREATE_MANY_OPS.has(operation)) {
    const data = next.data;
    next.data = Array.isArray(data)
      ? data.map((row) => withTenant(row, tenantId))
      : withTenant(data as Record<string, unknown> | undefined, tenantId);
    return next;
  }
  if (operation === UPSERT_OP) {
    next.where = withTenant(next.where, tenantId);
    next.create = withTenant(next.create, tenantId);
    return next;
  }
  // All remaining operations (findFirst/findMany/count/aggregate/groupBy/update/
  // updateMany/delete/deleteMany/findUnique…) filter by `where` — scope it.
  next.where = withTenant(next.where, tenantId);
  return next;
}

// ── Request-scoped tenant store ──────────────────────────────────────────────
// The adapter is constructed once (stateless, no per-request context reaches it),
// so the current tenant travels in an AsyncLocalStorage the request entrypoint
// populates. The $extends hook reads it per operation.

const storage = new AsyncLocalStorage<string>();

/** Run `fn` with `tenantId` as the ambient auth tenant for every nested op. */
export function runWithAuthTenant<T>(tenantId: string, fn: () => T): T {
  return storage.run(tenantId, fn);
}

/** The ambient auth tenant, or `undefined` outside a {@link runWithAuthTenant}. */
export function getAuthTenant(): string | undefined {
  return storage.getStore();
}

/** The ambient auth tenant, or throw — for the $extends hook's fail-closed read. */
export function requireAuthTenant(): string {
  const tenantId = storage.getStore();
  if (!tenantId) {
    throw new AuthTenantContextError(
      'No auth tenant in context — the Better Auth handler must run inside ' +
        'runWithAuthTenant(<hostname tenant>, …).',
    );
  }
  return tenantId;
}
