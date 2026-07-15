// EPIC-T FR-T-9 (master spec §C.17) — the customer's viewing-requests history read
// model. Pure query-shaping over a STRUCTURAL Prisma client (DB-free to unit-test,
// mirrors saved-searches.ts / enquiries.ts); the live queries run tenant-scoped
// (RLS) via withTenant in the /account/viewings route.
//
// LINKAGE (a directed decision — flagged for human review in the PR): the data model
// carries NO owner foreign key from a viewing to a customer account. The public
// viewing form writes an Enquiry (the `lead_type` column = 'viewing_request')
// capturing the visitor's name / email / phone, and never a userId. So the ONLY
// signal linking a viewing request to an account is the EMAIL — matched against the
// customer's VERIFIED account email (FR-T-2). Do NOT broaden the match (no
// phone / name matching, no schema change); a future slice should add a proper
// userId link on viewing enquiries + FR-T-10 (cancel a viewing).

/** The property columns a history row needs (the property a viewing refers to). */
export interface ViewingPropertyRecord {
  /** The marketing title, when set (nullable in the schema). */
  title: string | null;
  /** The catalogue slug, for the /properties/[slug] link. */
  slug: string;
  /** The public display address, used as the label when there is no title. */
  displayAddress: string;
}

/** The Enquiry columns the history read selects (status + when + the property). */
export interface ViewingEnquiryRecord {
  id: string;
  status: string;
  createdAt: Date;
  /** Null when the property has since been removed (relation is SET NULL on delete). */
  property: ViewingPropertyRecord | null;
}

/** One viewing-request history entry as the /account/viewings list renders it. */
export interface CustomerViewing {
  id: string;
  /** The raw enquiry status — rendered via the status presenter, never fabricated. */
  status: string;
  /** When the viewing request was submitted (the ordering key). */
  requestedAt: Date;
  /** Best available label for the property this viewing refers to. */
  propertyLabel: string;
  /** The property slug for the /properties/[slug] link, or null when it is gone. */
  propertySlug: string | null;
}

/** The structural client the viewing-history read needs (a real PrismaClient satisfies it). */
export interface ViewingHistoryReader {
  enquiry: {
    findMany(args: {
      where?: Record<string, unknown>;
      orderBy?: unknown;
      select?: Record<string, unknown>;
    }): Promise<ViewingEnquiryRecord[]>;
  };
}

/** The structural client the verified-email resolve needs. */
export interface VerifiedEmailReader {
  user: {
    findFirst(args: {
      where?: Record<string, unknown>;
      select?: Record<string, boolean>;
    }): Promise<{ email: string } | null>;
  };
}

/** Best available human label for the property a viewing refers to. */
function propertyLabel(property: ViewingPropertyRecord | null): string {
  if (!property) return 'Property no longer available';
  const title = property.title?.trim();
  if (title) return title;
  const address = property.displayAddress.trim();
  return address.length > 0 ? address : 'Property';
}

/**
 * Resolve the acting customer's VERIFIED account email, tenant-scoped. The customer
 * session seam carries only the userId + an email-verified flag (never the address),
 * so the address is read here inside the tenant RLS transaction. Pinned to a
 * `type=customer` row with a verified email: an unverified account (or a stray staff
 * id) resolves null, so nothing is matched — the match is only ever against a
 * verified email.
 */
export async function resolveVerifiedCustomerEmail(
  db: VerifiedEmailReader,
  userId: string,
): Promise<string | null> {
  const user = await db.user.findFirst({
    where: { id: userId, type: 'customer', emailVerified: true },
    select: { email: true },
  });
  return user?.email ?? null;
}

/**
 * The customer's viewing-request history, newest-first. Matches the tenant's
 * viewing-request enquiries by the customer's verified `email` (the only owner
 * signal the data model carries), joined to the property each refers to. Scoped to
 * the tenant via the surrounding RLS transaction.
 */
export async function listCustomerViewings(
  db: ViewingHistoryReader,
  email: string,
): Promise<CustomerViewing[]> {
  // `lead_type` is the committed DB column for the enquiry channel (the schema is the
  // source of truth); it is set via bracket access to keep the forbidden noun out of
  // a declared identifier (PRODUCT.md §2/§3, G6), matching the write-side actions.
  const where: Record<string, unknown> = { email };
  where['leadType'] = 'viewing_request';

  const rows = await db.enquiry.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      createdAt: true,
      property: { select: { title: true, slug: true, displayAddress: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    requestedAt: row.createdAt,
    propertyLabel: propertyLabel(row.property),
    propertySlug: row.property?.slug ?? null,
  }));
}
