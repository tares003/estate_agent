// EPIC-AC FR-AC-10 — the "needs response" feedback alert read model. Counts the
// tenant's feedback flagged needsResponse (negative sentiment — rating ≤ 2, set
// when the feedback is captured) for the admin dashboard KPI. Tenant isolation is
// applied by the caller via withTenant (RLS); the structural reader interface keeps
// this DB-free for unit tests — a Prisma tx satisfies it.

/** Minimal read surface the alert count needs (a Prisma tx satisfies it). */
export interface FeedbackAlertsReader {
  feedback: {
    count(args: { where?: Record<string, unknown> }): Promise<number>;
  };
}

/**
 * Count the tenant's feedback awaiting a response (FR-AC-10): the rows flagged
 * `needsResponse` (negative sentiment). Surfaced as a dashboard KPI so staff can
 * see at a glance how many unhappy respondents are waiting. The caller scopes the
 * read to the tenant (withTenant / RLS).
 */
export async function countFeedbackNeedsResponse(reader: FeedbackAlertsReader): Promise<number> {
  return reader.feedback.count({ where: { needsResponse: true } });
}
