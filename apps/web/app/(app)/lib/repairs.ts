import { DEFAULT_PAGE_SIZE, type RepairStatus, type RepairUrgency } from '@estate/validators';

import { slaRisk, type SlaRisk } from './repair-sla.js';

// EPIC-G repairs inbox read model (master spec §G.2, FR-G-2/FR-G-9). Pure mapping
// over a STRUCTURAL Prisma client (DB-free to unit-test, mirrors lib/enquiries.ts);
// the live query runs tenant-scoped (RLS) via withTenant in the admin Server
// Component. URL-driven status/urgency filters + pagination; closed tickets
// (completed / rejected) are hidden unless explicitly asked for; each open item is
// banded by SLA-breach risk against the injected `now` (FR-G-9).

/** The RepairRequest columns the inbox reads. */
export interface RepairRow {
  id: string;
  name: string;
  /** The §G.1 human-readable ticket number (e.g. "RPR-2026-04321"). */
  reference: string | null;
  /** The tenant's free-text property pointer, until staff resolve `propertyId`. */
  propertyReference: string | null;
  category: string;
  urgency: string;
  status: string;
  createdAt: Date;
}

/** The inbox view model — a row plus its FR-G-9 risk band (null when closed). */
export interface RepairQueueItem extends RepairRow {
  slaRisk: SlaRisk | null;
}

/** The structural client the read model needs (a real PrismaClient satisfies it). */
export interface RepairListReader {
  repairRequest: {
    findMany(args: {
      where?: Record<string, unknown>;
      orderBy?: unknown;
      skip?: number;
      take?: number;
    }): Promise<RepairRow[]>;
    count(args: { where?: Record<string, unknown> }): Promise<number>;
  };
}

/** Inbox filter / sort / pagination inputs. */
export interface RepairQueueOptions {
  status?: RepairStatus;
  urgency?: RepairUrgency;
  sort?: 'newest' | 'oldest';
  page?: number;
  pageSize?: number;
}

/** A page of inbox items plus the totals the UI paginates with. */
export interface RepairQueueResult {
  items: RepairQueueItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Build the Prisma `where` — closed tickets are hidden unless explicitly asked for. */
export function buildRepairWhere(options: RepairQueueOptions): Record<string, unknown> {
  const where: Record<string, unknown> = options.status
    ? { status: options.status }
    : { status: { notIn: ['completed', 'rejected'] } };
  if (options.urgency) where['urgency'] = options.urgency;
  return where;
}

/** List the tenant's repair requests for the inbox (newest-first by default). */
export async function listRepairRequests(
  db: RepairListReader,
  options: RepairQueueOptions,
  now: number,
): Promise<RepairQueueResult> {
  const where = buildRepairWhere(options);
  const orderBy = { createdAt: options.sort === 'oldest' ? 'asc' : 'desc' };
  const pageSize = clamp(options.pageSize ?? DEFAULT_PAGE_SIZE, 1, 60);
  const page = Math.max(1, options.page ?? 1);
  const skip = (page - 1) * pageSize;

  const [rows, total] = await Promise.all([
    db.repairRequest.findMany({ where, orderBy, skip, take: pageSize }),
    db.repairRequest.count({ where }),
  ]);

  return {
    items: rows.map((row) => ({ ...row, slaRisk: slaRisk(row, now) })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** The full ticket the triage detail reads (FR-G-6). */
export interface RepairDetailRow extends RepairRow {
  email: string;
  phone: string | null;
  description: string;
  rejectedReason: string | null;
  /** The matched catalogue listing (§G.6 — matched by admin), when resolved. */
  propertyId: string | null;
  /** The assigned contractor (§G.6 / FR-G-8), when assigned. */
  assignedContractorId: string | null;
  updatedAt: Date;
}

/** The structural client the detail read needs. */
export interface RepairDetailReader {
  repairRequest: {
    findFirst(args: { where: Record<string, unknown> }): Promise<RepairDetailRow | null>;
  };
}

/** Read one repair ticket by id (tenant-scoped by RLS), or null when unknown. */
export async function getRepairRequest(
  db: RepairDetailReader,
  id: string,
): Promise<RepairDetailRow | null> {
  return db.repairRequest.findFirst({ where: { id } });
}
