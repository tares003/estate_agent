// EPIC-AC FR-AC-7 — the per-agent rating rollup read model. For each agent that has
// feedback, computes the mean rating (1 dp) and the number of feedback rows, ordered
// best-first (average desc, then count desc). Feedback with no agentActor is excluded
// — only attributable feedback rolls up to an agent. Tenant isolation is applied by
// the caller via withTenant (RLS); the structural reader keeps this DB-free for unit
// tests — a Prisma tx satisfies it.

/** A single feedback row the rollup needs (agentActor known to be set). */
export interface AgentRatingRow {
  agentActor: string;
  rating: number;
}

/** The rolled-up rating for one agent. */
export interface AgentRating {
  agentActor: string;
  /** Mean rating across the agent's feedback, rounded to 1 dp. */
  average: number;
  /** Number of feedback rows attributed to the agent. */
  count: number;
}

/** Minimal read surface the rollup needs (a Prisma tx satisfies it). */
export interface AgentRatingReader {
  feedback: {
    findMany(args: {
      where: { agentActor: { not: null } };
      select: { agentActor: true; rating: true };
    }): Promise<AgentRatingRow[]>;
  };
}

/** Round to one decimal place (e.g. 4.6666… → 4.7). */
function round1dp(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Roll feedback up per agent (FR-AC-7): the mean rating (1 dp) and feedback count
 * for every agent with at least one attributed feedback row, ordered by average
 * descending then count descending (a busier agent ranks above a quieter one on a
 * tie). Feedback with no `agentActor` is excluded by the query. Returns `[]` when no
 * agent has feedback. The caller scopes the read to the tenant (withTenant / RLS).
 */
export async function agentRatingRollup(reader: AgentRatingReader): Promise<AgentRating[]> {
  const rows = await reader.feedback.findMany({
    where: { agentActor: { not: null } },
    select: { agentActor: true, rating: true },
  });

  const totals = new Map<string, { sum: number; count: number }>();
  for (const { agentActor, rating } of rows) {
    const entry = totals.get(agentActor) ?? { sum: 0, count: 0 };
    entry.sum += rating;
    entry.count += 1;
    totals.set(agentActor, entry);
  }

  return [...totals.entries()]
    .map(([agentActor, { sum, count }]) => ({
      agentActor,
      average: round1dp(sum / count),
      count,
    }))
    .sort((a, b) => b.average - a.average || b.count - a.count);
}
