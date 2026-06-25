import { describe, expect, it, vi } from 'vitest';

import { feedbackAggregate, type FeedbackAggregateReader } from './feedback-aggregate.js';

// EPIC-AC FR-AC-6 — the live reviews aggregate read model. Computes the average
// rating (1 dp) + total count across the tenant's feedback. Tenant scoping is
// applied by the caller (withTenant); this just shapes the aggregate query and
// rounds the result. DB-free: a Prisma tx satisfies the structural reader.

function reader(result: { _avg: { rating: number | null }; _count: number }): {
  r: FeedbackAggregateReader;
  aggregate: ReturnType<typeof vi.fn>;
} {
  const aggregate = vi.fn().mockResolvedValue(result);
  return { r: { feedback: { aggregate } } as unknown as FeedbackAggregateReader, aggregate };
}

describe('feedbackAggregate', () => {
  it('returns a zero aggregate when there is no feedback', async () => {
    const { r } = reader({ _avg: { rating: null }, _count: 0 });
    expect(await feedbackAggregate(r)).toEqual({ average: 0, count: 0 });
  });

  it('returns the average and count when feedback exists', async () => {
    const { r } = reader({ _avg: { rating: 4.5 }, _count: 1284 });
    expect(await feedbackAggregate(r)).toEqual({ average: 4.5, count: 1284 });
  });

  it('rounds the average to one decimal place', async () => {
    const { r } = reader({ _avg: { rating: 4.8666667 }, _count: 30 });
    expect(await feedbackAggregate(r)).toEqual({ average: 4.9, count: 30 });
  });

  it('asks the reader to average the rating across every row', async () => {
    const { r, aggregate } = reader({ _avg: { rating: 5 }, _count: 1 });
    await feedbackAggregate(r);
    expect(aggregate.mock.calls[0]![0]).toEqual({ _avg: { rating: true }, _count: true });
  });
});
