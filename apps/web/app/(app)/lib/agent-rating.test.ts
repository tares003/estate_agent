// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { agentRatingRollup, type AgentRatingReader, type AgentRatingRow } from './agent-rating.js';

// EPIC-AC FR-AC-7 — the per-agent rating rollup read model. Averages each agent's
// feedback rating (1 dp) + counts the rows, excludes feedback with no agentActor,
// and orders by average desc then count desc. DB-free over a structural reader; the
// live query runs tenant-scoped via withTenant (RLS).

function reader(rows: AgentRatingRow[]): {
  r: AgentRatingReader;
  findMany: ReturnType<typeof vi.fn>;
} {
  const findMany = vi.fn().mockResolvedValue(rows);
  return { r: { feedback: { findMany } } as unknown as AgentRatingReader, findMany };
}

describe('agentRatingRollup', () => {
  it('returns an empty rollup when there is no feedback', async () => {
    const { r } = reader([]);
    expect(await agentRatingRollup(r)).toEqual([]);
  });

  it('averages each agent (1 dp) and counts the rows', async () => {
    const { r } = reader([
      { agentActor: 'Avery Adams', rating: 5 },
      { agentActor: 'Avery Adams', rating: 4 },
      { agentActor: 'Avery Adams', rating: 4 },
    ]);
    expect(await agentRatingRollup(r)).toEqual([
      { agentActor: 'Avery Adams', average: 4.3, count: 3 },
    ]);
  });

  it('rolls up multiple agents and orders by average desc then count desc', async () => {
    const { r } = reader([
      // Blake: avg 4.0, count 2
      { agentActor: 'Blake Brooks', rating: 4 },
      { agentActor: 'Blake Brooks', rating: 4 },
      // Avery: avg 5.0, count 1
      { agentActor: 'Avery Adams', rating: 5 },
      // Casey: avg 5.0, count 3 — ties Avery on average, wins on count
      { agentActor: 'Casey Cole', rating: 5 },
      { agentActor: 'Casey Cole', rating: 5 },
      { agentActor: 'Casey Cole', rating: 5 },
    ]);
    expect(await agentRatingRollup(r)).toEqual([
      { agentActor: 'Casey Cole', average: 5, count: 3 },
      { agentActor: 'Avery Adams', average: 5, count: 1 },
      { agentActor: 'Blake Brooks', average: 4, count: 2 },
    ]);
  });

  it('rounds each average to one decimal place', async () => {
    const { r } = reader([
      { agentActor: 'Drew Davies', rating: 5 },
      { agentActor: 'Drew Davies', rating: 5 },
      { agentActor: 'Drew Davies', rating: 4 },
    ]);
    // 14 / 3 = 4.6666… → 4.7
    expect(await agentRatingRollup(r)).toEqual([
      { agentActor: 'Drew Davies', average: 4.7, count: 3 },
    ]);
  });

  it('excludes feedback that has no agentActor', async () => {
    const { r, findMany } = reader([{ agentActor: 'Avery Adams', rating: 5 }]);
    await agentRatingRollup(r);
    // the query only fetches rows whose agentActor is set
    expect(findMany.mock.calls[0]![0]).toEqual({
      where: { agentActor: { not: null } },
      select: { agentActor: true, rating: true },
    });
  });
});
