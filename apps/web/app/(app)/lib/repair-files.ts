// EPIC-G repair attachments (FR-G-2, master spec §G.6) — the ticket-files read
// model. Pure query-shaping over a STRUCTURAL Prisma client (DB-free to
// unit-test); the live query runs tenant-scoped (RLS) via withTenant. `url`
// holds the StorageBackend KEY — serving mints signed URLs at render time
// (CLAUDE.md §9). Oldest-first: the order the reporter attached them.

/** A ticket attachment row (the columns the admin detail reads). */
export interface RepairFileRow {
  id: string;
  url: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  uploadedBy: string;
  createdAt: Date;
}

/** The structural client the read model needs (a real PrismaClient satisfies it). */
export interface RepairFileReader {
  repairFile: {
    findMany(args: {
      where?: Record<string, unknown>;
      orderBy?: unknown;
    }): Promise<RepairFileRow[]>;
  };
}

/** List a ticket's attachments, oldest-first. */
export async function listRepairFiles(
  db: RepairFileReader,
  repairRequestId: string,
): Promise<RepairFileRow[]> {
  return db.repairFile.findMany({
    where: { repairRequestId },
    orderBy: { createdAt: 'asc' },
  });
}
