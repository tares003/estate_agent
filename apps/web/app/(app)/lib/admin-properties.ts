import { DEFAULT_PAGE_SIZE } from '@estate/validators';

// EPIC-H property management (FR-H-2 list) read model — the admin catalogue. Unlike
// the public catalogue (which only shows PUBLISHED listings), this shows EVERY
// listing including unpublished drafts, so staff can manage work-in-progress. Pure
// mapping over a STRUCTURAL Prisma client (DB-free to unit-test, mirrors
// contacts.ts); the live query runs tenant-scoped (RLS) via withTenant. Soft-deleted
// listings are hidden.

/** The Property columns the admin list reads. */
export interface AdminPropertyRow {
  id: string;
  title: string | null;
  displayAddress: string;
  saleType: string;
  marketStatus: string;
  price: number | null;
  publishedAt: Date | null;
}

/** The structural client the read model needs (a real PrismaClient satisfies it). */
export interface AdminPropertyReader {
  property: {
    findMany(args: {
      where?: Record<string, unknown>;
      orderBy?: unknown;
      skip?: number;
      take?: number;
    }): Promise<AdminPropertyRow[]>;
    count(args: { where?: Record<string, unknown> }): Promise<number>;
  };
}

/** Pagination inputs for the admin catalogue. */
export interface AdminPropertyOptions {
  page?: number;
  pageSize?: number;
}

/** A page of listings plus the totals the UI paginates with. */
export interface AdminPropertyResult {
  items: AdminPropertyRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const MAX_PAGE_SIZE = 60;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** The admin `where`: every non-deleted listing (drafts included). */
export function buildAdminPropertyWhere(): Record<string, unknown> {
  return { deletedAt: null };
}

/** List the tenant's listings (newest-first, drafts included), paginated. */
export async function listAdminProperties(
  db: AdminPropertyReader,
  options: AdminPropertyOptions,
): Promise<AdminPropertyResult> {
  const where = buildAdminPropertyWhere();
  const pageSize = clamp(options.pageSize ?? DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
  const page = Math.max(1, options.page ?? 1);
  const skip = (page - 1) * pageSize;

  const [items, total] = await Promise.all([
    db.property.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
    db.property.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** A single listing's columns the admin detail reads (drafts included). */
export interface AdminPropertyDetail {
  id: string;
  title: string | null;
  displayAddress: string;
  postcode: string;
  saleType: string;
  marketStatus: string;
  price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  receptions: number | null;
  description: string | null;
  publishedAt: Date | null;
}

/** The structural client the detail read needs (a real PrismaClient satisfies it). */
export interface AdminPropertyDetailReader {
  property: {
    findFirst(args: { where: Record<string, unknown> }): Promise<AdminPropertyDetail | null>;
  };
}

/** Load a single listing by id (drafts included; soft-deleted excluded). */
export async function getAdminProperty(
  db: AdminPropertyDetailReader,
  id: string,
): Promise<AdminPropertyDetail | null> {
  return db.property.findFirst({ where: { id, deletedAt: null } });
}
