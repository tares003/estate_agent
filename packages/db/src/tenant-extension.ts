import type { PrismaClient } from '@prisma/client';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Build the `SET LOCAL app.current_tenant_id = '<uuid>'` statement that the RLS
 * policies (migrations/raw/0002_rls_policies.sql) read via `current_setting`.
 *
 * The tenant id is validated as a UUID before interpolation — only hex + hyphens
 * can appear, so there is no SQL-injection surface even though the value is
 * inlined (Postgres GUC SET does not accept bind parameters).
 *
 * @throws if `tenantId` is not a well-formed UUID.
 */
export function tenantGucStatement(tenantId: string): string {
  if (!UUID_RE.test(tenantId)) {
    throw new Error(`Invalid tenant id (expected a UUID): ${JSON.stringify(tenantId)}`);
  }
  return `SET LOCAL app.current_tenant_id = '${tenantId}'`;
}

/** Minimal surface of PrismaClient that {@link withTenant} needs (eases testing). */
export interface TenantTransactionClient {
  $transaction<T>(fn: (tx: TenantQueryClient) => Promise<T>): Promise<T>;
}
export interface TenantQueryClient {
  $executeRawUnsafe(query: string): Promise<number>;
}

/**
 * Run `fn` inside a transaction that first sets the tenant GUC, so every query
 * `fn` issues is constrained by the RLS policies to the given tenant. This is
 * the per-request mechanism CLAUDE.md §9 describes.
 */
export async function withTenant<T>(
  client: TenantTransactionClient,
  tenantId: string,
  fn: (tx: TenantQueryClient) => Promise<T>,
): Promise<T> {
  const statement = tenantGucStatement(tenantId);
  return client.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(statement);
    return fn(tx);
  });
}

/** Convenience: assert a real PrismaClient satisfies the structural client type. */
export type AnyPrismaClient = PrismaClient;
