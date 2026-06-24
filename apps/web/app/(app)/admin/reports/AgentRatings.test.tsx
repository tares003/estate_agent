// responsive-coverage: opt-out all — asserts the per-agent rating table rendering +
// the empty state; layout is the admin-routes Playwright pass (design-requirements §3).
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';

import { AgentRatings } from './AgentRatings.js';

// EPIC-AC FR-AC-7 — the per-agent rating rollup view. Presentational + pure;
// token-driven (G7). One row per agent (name, average score, review count). The
// numbers come from the unit-tested read model.
describe('AgentRatings', () => {
  it('renders one table row per agent with the score and count', () => {
    render(
      <AgentRatings
        rows={[
          { agentActor: 'Casey Cole', average: 5, count: 3 },
          { agentActor: 'Blake Brooks', average: 4.3, count: 12 },
        ]}
      />,
    );
    const table = within(screen.getByRole('table'));
    expect(table.getByText('Casey Cole')).toBeInTheDocument();
    expect(table.getByText('Blake Brooks')).toBeInTheDocument();
    expect(table.getByText('4.3 / 5')).toBeInTheDocument();
    expect(table.getByText('12')).toBeInTheDocument();
  });

  it('shows a calm empty state when no agent has feedback', () => {
    render(<AgentRatings rows={[]} />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('No agent feedback in this period.')).toBeInTheDocument();
  });
});
