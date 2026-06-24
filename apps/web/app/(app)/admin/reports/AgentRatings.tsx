import type { AgentRating } from '../../lib/agent-rating.js';

// EPIC-AC FR-AC-7 — the per-agent rating rollup view. Presentational + pure;
// token-driven (G7). One row per agent (name, average score out of 5, review
// count), ordered best-first by the unit-tested read model. A calm empty state
// shows when no agent has attributable feedback.

/** The fixed review scale (1–5 per FR-AC-3). */
const SCALE = 5;

export function AgentRatings({ rows }: { rows: AgentRating[] }) {
  return (
    <section aria-labelledby="agent-ratings-heading" className="flex flex-col gap-3">
      <h2 id="agent-ratings-heading" className="t-heading-sm">
        Agent ratings
      </h2>
      {rows.length === 0 ? (
        <p className="t-body-sm text-text-secondary">No agent feedback in this period.</p>
      ) : (
        <table className="w-full max-w-[48ch] border-collapse text-left">
          <thead>
            <tr className="border-divider border-b">
              <th scope="col" className="t-body-sm text-text-secondary py-2 pr-4 font-semibold">
                Agent
              </th>
              <th scope="col" className="t-body-sm text-text-secondary py-2 pr-4 font-semibold">
                Average score
              </th>
              <th scope="col" className="t-body-sm text-text-secondary py-2 font-semibold">
                Reviews
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((agent) => (
              <tr key={agent.agentActor} className="border-divider border-b">
                <td className="t-body-md py-2 pr-4">{agent.agentActor}</td>
                <td className="t-body-md py-2 pr-4">
                  {agent.average} / {SCALE}
                </td>
                <td className="t-body-md py-2">{agent.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
