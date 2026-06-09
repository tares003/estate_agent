import { DEFAULT_PAGE_SIZE } from '@estate/validators';

// EPIC-H audit-log viewer (FR-H-17) read model — the tenant's audit trail. Pure
// query-shaping over a STRUCTURAL Prisma client (DB-free to unit-test, mirrors
// contacts.ts); the live query runs tenant-scoped (RLS already isolates audit_logs)
// via withTenant in the admin audit page. Append-only, newest-first.

/** An audit-trail entry (the columns the viewer reads). */
export interface AuditLogRow {
  id: string;
  actor: string;
  action: string;
  entity: string;
  entityId: string | null;
  diff: unknown;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
}

/** The structural client the read model needs (a real PrismaClient satisfies it). */
export interface AuditLogReader {
  auditLog: {
    findMany(args: {
      where?: Record<string, unknown>;
      orderBy?: unknown;
      skip?: number;
      take?: number;
    }): Promise<AuditLogRow[]>;
    count(args: { where?: Record<string, unknown> }): Promise<number>;
  };
}

/** Filter / pagination inputs for the viewer. */
export interface AuditLogOptions {
  entity?: string;
  page?: number;
  pageSize?: number;
}

/** A page of audit entries plus the totals the UI paginates with. */
export interface AuditLogResult {
  items: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const MAX_PAGE_SIZE = 100;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Build the Prisma `where` for the viewer (optional entity filter). */
export function buildAuditWhere(options: AuditLogOptions): Record<string, unknown> {
  return options.entity ? { entity: options.entity } : {};
}

/** List the tenant's audit entries, newest-first, filtered + paginated. */
export async function listAuditLogs(
  db: AuditLogReader,
  options: AuditLogOptions,
): Promise<AuditLogResult> {
  const where = buildAuditWhere(options);
  const pageSize = clamp(options.pageSize ?? DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
  const page = Math.max(1, options.page ?? 1);
  const skip = (page - 1) * pageSize;

  const [items, total] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
    db.auditLog.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
