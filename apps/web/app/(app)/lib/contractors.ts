// EPIC-G contractors (FR-G-8, master spec §G.6) — the directory read model. Pure
// query-shaping over a STRUCTURAL Prisma client (DB-free to unit-test); the live
// query runs tenant-scoped (RLS) via withTenant. Name order — the admin picker
// view.

/** A contractor directory row. */
export interface ContractorRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  trade: string | null;
  active: boolean;
}

/** The structural client the read model needs (a real PrismaClient satisfies it). */
export interface ContractorReader {
  contractor: {
    findMany(args: { orderBy?: unknown }): Promise<ContractorRow[]>;
  };
}

/** List the tenant's contractors, in name order. */
export async function listContractors(db: ContractorReader): Promise<ContractorRow[]> {
  return db.contractor.findMany({ orderBy: { name: 'asc' } });
}
