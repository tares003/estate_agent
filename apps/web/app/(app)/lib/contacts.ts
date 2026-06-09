import { DEFAULT_PAGE_SIZE, type ContactType } from '@estate/validators';

// EPIC-H contacts (FR-H-7) read model — the contact directory. Pure mapping over a
// STRUCTURAL Prisma client (DB-free to unit-test, mirrors enquiries.ts); the live
// query runs tenant-scoped (RLS) via withTenant in the admin contacts page.
// Soft-deleted contacts (deletedAt set) are hidden.

/** The Contact columns the directory reads. */
export interface ContactRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  type: string;
  createdAt: Date;
}

/** The structural client the read model needs (a real PrismaClient satisfies it). */
export interface ContactListReader {
  contact: {
    findMany(args: {
      where?: Record<string, unknown>;
      orderBy?: unknown;
      skip?: number;
      take?: number;
    }): Promise<ContactRow[]>;
    count(args: { where?: Record<string, unknown> }): Promise<number>;
  };
}

/** Filter / pagination inputs for the directory. */
export interface ContactListOptions {
  type?: ContactType;
  page?: number;
  pageSize?: number;
}

/** A page of contacts plus the totals the UI paginates with. */
export interface ContactListResult {
  items: ContactRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const MAX_PAGE_SIZE = 60;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Build the Prisma `where` for the directory — soft-deleted contacts are hidden. */
export function buildContactWhere(options: ContactListOptions): Record<string, unknown> {
  const where: Record<string, unknown> = { deletedAt: null };
  if (options.type) where['type'] = options.type;
  return where;
}

/** List the tenant's contacts (newest-first), filtered + paginated. */
export async function listContacts(
  db: ContactListReader,
  options: ContactListOptions,
): Promise<ContactListResult> {
  const where = buildContactWhere(options);
  const pageSize = clamp(options.pageSize ?? DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
  const page = Math.max(1, options.page ?? 1);
  const skip = (page - 1) * pageSize;

  const [items, total] = await Promise.all([
    db.contact.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
    db.contact.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
