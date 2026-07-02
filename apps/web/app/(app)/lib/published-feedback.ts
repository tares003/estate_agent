// EPIC-AC FR-AC-5 — the PUBLIC published-feedback read model. Surfaces the
// moderated feedback a respondent asked to publish and an admin has published
// (status = published AND publishAsTestimonial), projecting ONLY the public-safe
// fields: rating, comment, date. The sensitive columns on the Feedback row —
// respondentRef, triggerType, triggerEntity(Id), agentActor, needsResponse,
// rejectedReason — never leave the data layer, so no personal or operational
// data reaches the public site (design brief §31: respondent is anonymised).
//
// Pure query-shaping over a STRUCTURAL Prisma client (DB-free to unit-test,
// mirrors blog.ts / feedback-aggregate.ts). The live query runs tenant-scoped
// (RLS) via withTenant in the /testimonials route + the data-driven block.

/** The Feedback columns the public read touches (the published subset). */
export interface PublishedFeedbackRow {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
}

/** A public testimonial — the safe projection of a published feedback row. */
export interface PublicTestimonial {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
}

/** The structural client the read model needs (a real PrismaClient satisfies it). */
export interface PublishedFeedbackReader {
  feedback: {
    findMany(args: {
      where?: Record<string, unknown>;
      orderBy?: unknown;
      skip?: number;
      take?: number;
    }): Promise<PublishedFeedbackRow[]>;
    count(args: { where?: Record<string, unknown> }): Promise<number>;
  };
}

/** A page of testimonials plus the totals the UI needs to paginate. */
export interface PublishedFeedbackResult {
  items: PublicTestimonial[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** The public testimonials list options (page + page size). */
export interface PublishedFeedbackOptions {
  page?: number;
  pageSize?: number;
}

/** The default testimonials page size. */
export const PUBLISHED_FEEDBACK_PAGE_SIZE = 12;

/** Clamp `value` into [min, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * The public predicate: only feedback that has been moderated to `published` AND
 * that the respondent asked to publish as a testimonial. Anything pending or
 * rejected — or published but not marked publishable — is excluded.
 */
const PUBLIC_WHERE = { status: 'published', publishAsTestimonial: true } as const;

/**
 * Project a feedback row down to the public-safe testimonial. Only rating,
 * comment and date survive; every sensitive column is dropped here so it can
 * never reach the public surface even if the reader over-selects.
 */
export function toTestimonial(row: PublishedFeedbackRow): PublicTestimonial {
  return {
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.createdAt,
  };
}

/**
 * List published testimonials, newest first, one page at a time. Filters to the
 * public predicate (published + publishable) so pending / rejected feedback never
 * leaks, and projects each row to the safe field set. The query runs tenant-scoped
 * (RLS) via withTenant in the caller; here the client is structural so it is
 * DB-free to test. Returns an empty page — never fabricated rows — when there is
 * no published feedback.
 */
export async function listPublishedFeedback(
  db: PublishedFeedbackReader,
  options: PublishedFeedbackOptions = {},
): Promise<PublishedFeedbackResult> {
  const where = { ...PUBLIC_WHERE };
  const pageSize = clamp(options.pageSize ?? PUBLISHED_FEEDBACK_PAGE_SIZE, 1, 60);
  const page = Math.max(1, options.page ?? 1);
  const skip = (page - 1) * pageSize;

  const [rows, total] = await Promise.all([
    db.feedback.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
    db.feedback.count({ where }),
  ]);

  return {
    items: rows.map(toTestimonial),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
