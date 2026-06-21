// EPIC-AC FR-AC-5 — the admin moderation queue read model. Shapes the tenant-scoped
// query that lists feedback awaiting a decision; tenant isolation is applied by the
// caller via withTenant (RLS). The structural reader interface keeps this DB-free
// for unit tests — a Prisma tx satisfies it.

/** A row shown in the moderation queue. */
export interface FeedbackQueueRow {
  id: string;
  rating: number;
  comment: string | null;
  status: string;
  publishAsTestimonial: boolean;
  needsResponse: boolean;
  triggerType: string;
  createdAt: Date;
}

/** Minimal read surface the queue needs (a Prisma tx satisfies it). */
export interface FeedbackQueueReader {
  feedback: {
    findMany(args: {
      where?: Record<string, unknown>;
      orderBy?: unknown;
      take?: number;
    }): Promise<FeedbackQueueRow[]>;
  };
}

/** Options narrowing the moderation queue. */
export interface FeedbackQueueOptions {
  /** Moderation status to show (default `pending`). */
  status?: string;
  /** Restrict to publishable feedback — the moderation queue proper (default true). */
  publishableOnly?: boolean;
}

const MAX_ROWS = 200;

/**
 * List feedback for moderation, newest first. By default shows the PENDING,
 * PUBLISHABLE feedback (FR-AC-5 — the queue of entries a respondent asked to
 * publish, awaiting a decision); callers can widen to any status / all feedback.
 */
export async function listFeedbackForModeration(
  reader: FeedbackQueueReader,
  options: FeedbackQueueOptions = {},
): Promise<FeedbackQueueRow[]> {
  const status = options.status ?? 'pending';
  const publishableOnly = options.publishableOnly ?? true;

  const where: Record<string, unknown> = { status };
  if (publishableOnly) {
    where['publishAsTestimonial'] = true;
  }

  return reader.feedback.findMany({ where, orderBy: { createdAt: 'desc' }, take: MAX_ROWS });
}
