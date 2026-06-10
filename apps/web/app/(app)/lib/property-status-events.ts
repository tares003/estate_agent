// EPIC-H property management (master spec §J.3) — the property market-status timeline
// read model. Pure query-shaping over a STRUCTURAL Prisma client (DB-free to
// unit-test, mirrors enquiry-status-events.ts); the live query runs tenant-scoped
// (RLS) via withTenant in the admin property detail page. Newest-first.

/** A market-status transition in a listing's timeline. */
export interface PropertyStatusEventRow {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  changedByAgentId: string | null;
  changedAt: Date;
}

/** The structural client the read model needs (a real PrismaClient satisfies it). */
export interface PropertyEventReader {
  propertyStatusEvent: {
    findMany(args: {
      where?: Record<string, unknown>;
      orderBy?: unknown;
    }): Promise<PropertyStatusEventRow[]>;
  };
}

/** List a listing's market-status transitions, newest-first. */
export async function listPropertyStatusEvents(
  db: PropertyEventReader,
  propertyId: string,
): Promise<PropertyStatusEventRow[]> {
  return db.propertyStatusEvent.findMany({
    where: { propertyId },
    orderBy: { changedAt: 'desc' },
  });
}
