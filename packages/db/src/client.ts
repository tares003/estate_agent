import { PrismaClient } from '@prisma/client';

export { Prisma, PrismaClient } from '@prisma/client';
export type {
  PlatformTenant,
  User,
  AuditLog,
  ConsentLog,
  NotificationLog,
  TenantStatus,
} from '@prisma/client';

/**
 * Construct a base PrismaClient. Per-request tenant isolation is applied on top
 * via {@link withTenant} (which sets the `app.current_tenant_id` GUC the RLS
 * policies read). Operator-admin handlers use a separate privileged role.
 */
export function createPrismaClient(
  options?: ConstructorParameters<typeof PrismaClient>[0],
): PrismaClient {
  return new PrismaClient(options);
}
