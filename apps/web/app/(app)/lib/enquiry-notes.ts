// EPIC-I CRM read model — the enquiry note thread (FR-I-5). Pure query-shaping over
// a STRUCTURAL Prisma client (DB-free to unit-test, mirrors enquiries.ts); the live
// query runs tenant-scoped (RLS) via withTenant in the admin Server Component.
// Notes are polymorphic (entityType + entityId); a client-facing view drops the
// staff-internal ones.

/** A note in an enquiry's thread (the columns the thread reads). */
export interface EnquiryNote {
  id: string;
  body: string;
  isInternal: boolean;
  authorAgentId: string | null;
  createdAt: Date;
}

/** The structural client the read model needs (a real PrismaClient satisfies it). */
export interface NoteListReader {
  note: {
    findMany(args: { where?: Record<string, unknown>; orderBy?: unknown }): Promise<EnquiryNote[]>;
  };
}

/** Thread options — a client-facing view sets `includeInternal: false`. */
export interface EnquiryNotesOptions {
  includeInternal?: boolean;
}

/** Build the polymorphic `where` for an enquiry's notes; hide internal ones when asked. */
export function buildEnquiryNotesWhere(
  enquiryId: string,
  options: EnquiryNotesOptions,
): Record<string, unknown> {
  const where: Record<string, unknown> = { entityType: 'enquiry', entityId: enquiryId };
  if (options.includeInternal === false) {
    where['isInternal'] = false;
  }
  return where;
}

/** List an enquiry's note thread, newest-first. */
export async function listEnquiryNotes(
  db: NoteListReader,
  enquiryId: string,
  options: EnquiryNotesOptions,
): Promise<EnquiryNote[]> {
  return db.note.findMany({
    where: buildEnquiryNotesWhere(enquiryId, options),
    orderBy: { createdAt: 'desc' },
  });
}
