import { DEFAULT_PAGE_SIZE } from '@estate/validators';

// EPIC-H user/role management (FR-H-15) read model — the staff directory. Pure
// mapping over a STRUCTURAL Prisma client (DB-free to unit-test, mirrors
// contacts.ts); the live query runs tenant-scoped (RLS already isolates users) via
// withTenant in the admin users page. Ordered by name (a directory).

/** The staff-user columns the directory reads. */
export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
}

/** The structural client the read model needs (a real PrismaClient satisfies it). */
export interface UserListReader {
  user: {
    findMany(args: {
      where?: Record<string, unknown>;
      orderBy?: unknown;
      skip?: number;
      take?: number;
    }): Promise<UserRow[]>;
    count(args: { where?: Record<string, unknown> }): Promise<number>;
  };
}

/** Pagination inputs for the directory. */
export interface UserListOptions {
  page?: number;
  pageSize?: number;
}

/** A page of users plus the totals the UI paginates with. */
export interface UserListResult {
  items: UserRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const MAX_PAGE_SIZE = 60;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** List the tenant's staff users, name-ordered, paginated. */
export async function listUsers(
  db: UserListReader,
  options: UserListOptions,
): Promise<UserListResult> {
  const pageSize = clamp(options.pageSize ?? DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
  const page = Math.max(1, options.page ?? 1);
  const skip = (page - 1) * pageSize;

  const [items, total] = await Promise.all([
    db.user.findMany({ orderBy: { name: 'asc' }, skip, take: pageSize }),
    db.user.count({}),
  ]);

  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
