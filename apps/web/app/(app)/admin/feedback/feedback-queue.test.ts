import { describe, expect, it, vi } from 'vitest';

import { listFeedbackForModeration, type FeedbackQueueReader } from './feedback-queue.js';

// EPIC-AC FR-AC-5 — the admin moderation queue read model. Lists feedback awaiting
// a decision (newest first), optionally narrowed to the publishable ones (the queue
// proper) or a specific moderation status. Tenant scoping is applied by the caller
// (withTenant); this just shapes the query + passes rows through.

function reader(rows: unknown[]): { r: FeedbackQueueReader; findMany: ReturnType<typeof vi.fn> } {
  const findMany = vi.fn().mockResolvedValue(rows);
  return { r: { feedback: { findMany } } as unknown as FeedbackQueueReader, findMany };
}

describe('listFeedbackForModeration', () => {
  it('defaults to the pending, publishable queue, newest first', async () => {
    const { r, findMany } = reader([]);
    await listFeedbackForModeration(r);
    const args = findMany.mock.calls[0]![0];
    expect(args.where).toEqual({ status: 'pending', publishAsTestimonial: true });
    expect(args.orderBy).toEqual({ createdAt: 'desc' });
  });

  it('can filter by an explicit status and include non-publishable feedback', async () => {
    const { r, findMany } = reader([]);
    await listFeedbackForModeration(r, { status: 'published', publishableOnly: false });
    expect(findMany.mock.calls[0]![0].where).toEqual({ status: 'published' });
  });

  it('returns the rows from the reader', async () => {
    const rows = [{ id: 'f1', rating: 5, status: 'pending' }];
    const { r } = reader(rows);
    expect(await listFeedbackForModeration(r)).toEqual(rows);
  });
});
