// EPIC-AC FR-AC-6 — the live reviews aggregate read model. Computes the tenant's
// average rating + total feedback count for the public reviews badge, over the
// MODERATED (status = published) feedback only — pending and rejected rows must
// never move the public average or count (audit: aggregate previously spanned all
// rows, so unmoderated/replayed submissions could skew the badge). Tenant
// isolation is applied by the caller via withTenant (RLS); the structural reader
// interface keeps this DB-free for unit tests — a Prisma tx satisfies it.

/** The aggregate the public reviews badge renders. */
export interface FeedbackAggregate {
  /** Mean rating across the tenant's published feedback, 1 dp; 0 when empty. */
  average: number;
  /** Total number of published feedback rows counted. */
  count: number;
}

/** The public predicate: only feedback an admin has moderated to published. */
const PUBLIC_AGGREGATE_WHERE = { status: 'published' } as const;

/** Minimal read surface the aggregate needs (a Prisma tx satisfies it). */
export interface FeedbackAggregateReader {
  feedback: {
    aggregate(args: {
      where: typeof PUBLIC_AGGREGATE_WHERE;
      _avg: { rating: true };
      _count: true;
    }): Promise<{ _avg: { rating: number | null }; _count: number }>;
  };
}

/** Round to one decimal place (e.g. 4.8666… → 4.9). */
function round1dp(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * The tenant's review aggregate (FR-AC-6): the average rating across the tenant's
 * published feedback (1 dp) and the total count. Scoped to `status: 'published'`
 * so pending / rejected feedback cannot influence the public badge. Returns
 * `{ average: 0, count: 0 }` when there is no published feedback — the badge
 * renders nothing in that case rather than a fabricated score. The caller scopes
 * the read to the tenant (withTenant / RLS).
 */
export async function feedbackAggregate(
  reader: FeedbackAggregateReader,
): Promise<FeedbackAggregate> {
  const { _avg, _count } = await reader.feedback.aggregate({
    where: PUBLIC_AGGREGATE_WHERE,
    _avg: { rating: true },
    _count: true,
  });
  if (_count === 0 || _avg.rating == null) {
    return { average: 0, count: 0 };
  }
  return { average: round1dp(_avg.rating), count: _count };
}
