// EPIC-AC FR-AC-6 — the live reviews aggregate read model. Computes the tenant's
// average rating + total feedback count for the public reviews badge. Tenant
// isolation is applied by the caller via withTenant (RLS); the structural reader
// interface keeps this DB-free for unit tests — a Prisma tx satisfies it.

/** The aggregate the public reviews badge renders. */
export interface FeedbackAggregate {
  /** Mean rating across the tenant's feedback, rounded to 1 dp; 0 when empty. */
  average: number;
  /** Total number of feedback rows counted. */
  count: number;
}

/** Minimal read surface the aggregate needs (a Prisma tx satisfies it). */
export interface FeedbackAggregateReader {
  feedback: {
    aggregate(args: {
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
 * The tenant's review aggregate (FR-AC-6): the average rating across all of the
 * tenant's feedback (1 dp) and the total count. Returns `{ average: 0, count: 0 }`
 * when there is no feedback — the badge renders nothing in that case rather than a
 * fabricated score. The caller scopes the read to the tenant (withTenant / RLS).
 */
export async function feedbackAggregate(
  reader: FeedbackAggregateReader,
): Promise<FeedbackAggregate> {
  const { _avg, _count } = await reader.feedback.aggregate({
    _avg: { rating: true },
    _count: true,
  });
  if (_count === 0 || _avg.rating == null) {
    return { average: 0, count: 0 };
  }
  return { average: round1dp(_avg.rating), count: _count };
}
