// EPIC-I / EPIC-H — the enquiry status timeline read model (master spec §I.3).
// Pure query-shaping over a STRUCTURAL Prisma client (DB-free to unit-test, mirrors
// enquiry-notes.ts); the live query runs tenant-scoped (RLS) via withTenant in the
// admin enquiry detail page. Newest-first.

/** A status transition in an enquiry's timeline (the columns the activity feed reads). */
export interface EnquiryStatusEventRow {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  changedByAgentId: string | null;
  changedAt: Date;
}

/** The structural client the read model needs (a real PrismaClient satisfies it). */
export interface StatusEventReader {
  enquiryStatusEvent: {
    findMany(args: {
      where?: Record<string, unknown>;
      orderBy?: unknown;
    }): Promise<EnquiryStatusEventRow[]>;
  };
}

/** List an enquiry's status transitions, newest-first. */
export async function listEnquiryStatusEvents(
  db: StatusEventReader,
  enquiryId: string,
): Promise<EnquiryStatusEventRow[]> {
  return db.enquiryStatusEvent.findMany({
    where: { enquiryId },
    orderBy: { changedAt: 'desc' },
  });
}
