import { describe, expect, it, vi } from 'vitest';

import { countFeedbackNeedsResponse, type FeedbackAlertsReader } from './feedback-alerts.js';

// EPIC-AC FR-AC-10 — the "needs response" feedback alert read model. Counts the
// tenant's feedback flagged needsResponse (negative sentiment, rating ≤ 2) for the
// admin dashboard KPI. Tenant scoping is applied by the caller (withTenant); this
// just shapes the count query. DB-free: a Prisma tx satisfies the structural reader.

function reader(result: number): { r: FeedbackAlertsReader; count: ReturnType<typeof vi.fn> } {
  const count = vi.fn().mockResolvedValue(result);
  return { r: { feedback: { count } } as unknown as FeedbackAlertsReader, count };
}

describe('countFeedbackNeedsResponse', () => {
  it('counts only the feedback flagged needsResponse', async () => {
    const { r, count } = reader(0);
    await countFeedbackNeedsResponse(r);
    expect(count.mock.calls[0]![0]).toEqual({ where: { needsResponse: true } });
  });

  it('returns the count from the reader', async () => {
    const { r } = reader(7);
    expect(await countFeedbackNeedsResponse(r)).toBe(7);
  });
});
