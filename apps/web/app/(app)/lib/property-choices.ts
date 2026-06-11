// EPIC-G repair triage (master spec §G.6) — the catalogue choices a staff member
// matches a ticket against. Pure query-shaping over a STRUCTURAL Prisma client
// (DB-free to unit-test); the live query runs tenant-scoped (RLS) via withTenant.
// V1 lists the tenant's full live catalogue (id + address only) — small-agency
// scale; a searchable picker is a later refinement once the client-query decision
// (ADR-0001) lands.

/** A listing the match select offers. */
export interface PropertyChoice {
  id: string;
  displayAddress: string;
}

/** The structural client the read model needs (a real PrismaClient satisfies it). */
export interface PropertyChoiceReader {
  property: {
    findMany(args: {
      where?: Record<string, unknown>;
      select?: Record<string, unknown>;
      orderBy?: unknown;
    }): Promise<PropertyChoice[]>;
  };
}

/** List the tenant's live listings as match choices, address-ordered. */
export async function listPropertyChoices(db: PropertyChoiceReader): Promise<PropertyChoice[]> {
  return db.property.findMany({
    where: { deletedAt: null },
    select: { id: true, displayAddress: true },
    orderBy: { displayAddress: 'asc' },
  });
}
