import { DEFAULT_PAGE_SIZE, type EnquiryStatus } from '@estate/validators';

// EPIC-I CRM read model — the enquiry queue. Pure mapping over a STRUCTURAL Prisma
// client (DB-free to unit-test, mirrors app/(app)/lib/properties.ts); the live
// query runs tenant-scoped (RLS) via withTenant in the admin Server Component.

/** The Enquiry columns the queue reads. */
export interface EnquiryRow {
  id: string;
  name: string;
  email: string;
  status: string;
  propertyId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Age urgency band for the queue (master spec §H.6). */
export type AgeBand = 'green' | 'amber' | 'red';

/** The queue view model (semantic-token-driven in the UI, never raw hex — G7). */
export interface EnquiryQueueItem {
  id: string;
  name: string;
  email: string;
  status: string;
  propertyId: string | null;
  ageBand: AgeBand;
}

/** The structural client the read model needs (a real PrismaClient satisfies it). */
export interface EnquiryListReader {
  enquiry: {
    findMany(args: {
      where?: Record<string, unknown>;
      orderBy?: unknown;
      skip?: number;
      take?: number;
    }): Promise<EnquiryRow[]>;
    count(args: { where?: Record<string, unknown> }): Promise<number>;
  };
}

/** Queue filter / sort / pagination inputs. */
export interface EnquiryQueueOptions {
  status?: EnquiryStatus;
  sort?: 'newest' | 'oldest';
  page?: number;
  pageSize?: number;
}

/** A page of queue items plus the totals the UI paginates with. */
export interface EnquiryQueueResult {
  items: EnquiryQueueItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const FOUR_HOURS_MS = 4 * 3_600_000;
const ONE_DAY_MS = 24 * 3_600_000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Map a row to a queue item, deriving the age band from the injected `now`. */
export function toQueueItem(row: EnquiryRow, now: number): EnquiryQueueItem {
  const ageMs = now - row.createdAt.getTime();
  const ageBand: AgeBand = ageMs <= FOUR_HOURS_MS ? 'green' : ageMs <= ONE_DAY_MS ? 'amber' : 'red';
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    status: row.status,
    propertyId: row.propertyId,
    ageBand,
  };
}

/** Build the Prisma `where` for the queue — archived is hidden unless explicitly asked for. */
export function buildEnquiryWhere(options: EnquiryQueueOptions): Record<string, unknown> {
  if (options.status) {
    return { status: options.status };
  }
  return { status: { not: 'archived' } };
}

/** List the tenant's enquiries for the queue (newest-first by default). */
export async function listEnquiries(
  db: EnquiryListReader,
  options: EnquiryQueueOptions,
  now: number,
): Promise<EnquiryQueueResult> {
  const where = buildEnquiryWhere(options);
  const orderBy = { createdAt: options.sort === 'oldest' ? 'asc' : 'desc' };
  const pageSize = clamp(options.pageSize ?? DEFAULT_PAGE_SIZE, 1, 60);
  const page = Math.max(1, options.page ?? 1);
  const skip = (page - 1) * pageSize;

  const [rows, total] = await Promise.all([
    db.enquiry.findMany({ where, orderBy, skip, take: pageSize }),
    db.enquiry.count({ where }),
  ]);

  return {
    items: rows.map((r) => toQueueItem(r, now)),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
