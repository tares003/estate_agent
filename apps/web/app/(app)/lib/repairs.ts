// EPIC-G repairs inbox read model (master spec §G, FR-G-2). Pure mapping over a
// STRUCTURAL Prisma client (DB-free to unit-test, mirrors lib/enquiries.ts); the
// live query runs tenant-scoped (RLS) via withTenant in the admin Server Component.
// Newest-first — the triage view; status/urgency filtering + pagination are a later
// refinement (as they were for the enquiry queue).

/** The RepairRequest columns the inbox reads. */
export interface RepairRow {
  id: string;
  name: string;
  reference: string | null;
  category: string;
  urgency: string;
  status: string;
  createdAt: Date;
}

/** The structural client the read model needs (a real PrismaClient satisfies it). */
export interface RepairListReader {
  repairRequest: {
    findMany(args: { orderBy?: unknown }): Promise<RepairRow[]>;
  };
}

/** List the tenant's repair requests, newest-first. */
export async function listRepairRequests(db: RepairListReader): Promise<RepairRow[]> {
  return db.repairRequest.findMany({ orderBy: { createdAt: 'desc' } });
}

/** The full ticket the triage detail reads (FR-G-6). */
export interface RepairDetailRow extends RepairRow {
  email: string;
  phone: string | null;
  description: string;
  rejectedReason: string | null;
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
