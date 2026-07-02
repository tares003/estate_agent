import { describe, expect, it, vi } from 'vitest';

import {
  listPublishedFeedback,
  toTestimonial,
  type PublishedFeedbackReader,
  type PublishedFeedbackRow,
} from './published-feedback.js';

// EPIC-AC FR-AC-5 — the PUBLIC published-feedback read model. Surfaces only the
// moderated, published-as-testimonial feedback, projecting ONLY the public-safe
// fields (rating, comment, date). Personal / operational fields — respondentRef,
// triggerType, triggerEntity(Id), agentActor, needsResponse, rejectedReason —
// never leave the data layer. Tenant scoping is applied by the caller (withTenant
// / RLS); the structural reader keeps this DB-free (a Prisma tx satisfies it).

function reader(rows: PublishedFeedbackRow[], total = rows.length) {
  const findMany = vi.fn().mockResolvedValue(rows);
  const count = vi.fn().mockResolvedValue(total);
  return {
    r: { feedback: { findMany, count } } as unknown as PublishedFeedbackReader,
    findMany,
    count,
  };
}

const row = (over: Partial<PublishedFeedbackRow> = {}): PublishedFeedbackRow => ({
  id: 'f1',
  rating: 5,
  comment: 'Outstanding service from start to finish.',
  createdAt: new Date('2026-04-01T09:00:00Z'),
  ...over,
});

describe('listPublishedFeedback', () => {
  it('queries ONLY published, publishable feedback (drafts / rejected never leak)', async () => {
    const { r, findMany, count } = reader([row()]);

    await listPublishedFeedback(r);

    const where = { status: 'published', publishAsTestimonial: true };
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where }));
    expect(count).toHaveBeenCalledWith({ where });
  });

  it('orders newest-published first and pages the results', async () => {
    const { r, findMany } = reader([row()], 25);

    const result = await listPublishedFeedback(r, { page: 2, pageSize: 6 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' }, skip: 6, take: 6 }),
    );
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(6);
    expect(result.total).toBe(25);
    expect(result.totalPages).toBe(5);
  });

  it('projects only the public-safe fields onto each testimonial', async () => {
    const { r } = reader([
      row({
        id: 'f9',
        rating: 4,
        comment: 'Great communication.',
        createdAt: new Date('2026-05-02T10:00:00Z'),
        // Sensitive columns present on the row are NOT projected.
        respondentRef: 'anon-123',
        triggerType: 'viewing_attended',
        agentActor: 'agent-7',
      } as Partial<PublishedFeedbackRow>),
    ]);

    const { items } = await listPublishedFeedback(r);

    expect(items).toEqual([
      {
        id: 'f9',
        rating: 4,
        comment: 'Great communication.',
        createdAt: new Date('2026-05-02T10:00:00Z'),
      },
    ]);
    // No sensitive keys survive the projection.
    for (const key of ['respondentRef', 'triggerType', 'triggerEntity', 'agentActor']) {
      expect(items[0]).not.toHaveProperty(key);
    }
  });

  it('clamps the page size into a sane range and defaults page to 1', async () => {
    const { r, findMany } = reader([]);

    await listPublishedFeedback(r, { page: 0, pageSize: 500 });

    const call = findMany.mock.calls[0]![0] as { take: number; skip: number };
    expect(call.take).toBeLessThanOrEqual(60);
    expect(call.skip).toBe(0);
  });

  it('returns an empty page (no fabricated rows) when there is no feedback', async () => {
    const { r } = reader([], 0);

    const result = await listPublishedFeedback(r);

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(1);
  });

  it('respects a limit-only call for the block (page 1, capped take)', async () => {
    const { r, findMany } = reader([row()]);

    await listPublishedFeedback(r, { pageSize: 3 });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 3, skip: 0 }));
  });
});

describe('toTestimonial', () => {
  it('keeps rating, comment and date and drops everything else', () => {
    const projected = toTestimonial(
      row({
        respondentRef: 'anon-9',
        triggerType: 'sale_completed',
        agentActor: 'agent-2',
      } as Partial<PublishedFeedbackRow>),
    );
    expect(projected).toEqual({
      id: 'f1',
      rating: 5,
      comment: 'Outstanding service from start to finish.',
      createdAt: new Date('2026-04-01T09:00:00Z'),
    });
  });

  it('preserves a null comment (rating-only feedback)', () => {
    expect(toTestimonial(row({ comment: null }))).toMatchObject({ comment: null });
  });
});
