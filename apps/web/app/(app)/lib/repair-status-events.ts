// EPIC-G repair system (master spec §G.5/§G.6, FR-G-7) — the ticket status-history
// read model. Pure query-shaping over a STRUCTURAL Prisma client (DB-free to
// unit-test, mirrors enquiry-status-events.ts); the live query runs tenant-scoped
// (RLS) via withTenant in the repair detail page. Newest-first.

/** A status transition in a ticket's history (the §G.6 repair_status_history row). */
export interface RepairStatusEventRow {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  actorUserId: string | null;
  notes: string | null;
  createdAt: Date;
}

/** The structural client the read model needs (a real PrismaClient satisfies it). */
export interface RepairEventReader {
  repairStatusEvent: {
    findMany(args: {
      where?: Record<string, unknown>;
      orderBy?: unknown;
    }): Promise<RepairStatusEventRow[]>;
  };
}

/** List a ticket's status transitions, newest-first. */
export async function listRepairStatusEvents(
  db: RepairEventReader,
  repairRequestId: string,
): Promise<RepairStatusEventRow[]> {
  return db.repairStatusEvent.findMany({
    where: { repairRequestId },
    orderBy: { createdAt: 'desc' },
  });
}
