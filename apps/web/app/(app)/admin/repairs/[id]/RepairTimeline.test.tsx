// responsive-coverage: opt-out all — asserts the timeline content; layout is the
// admin-routes Playwright pass (design-requirements §3).
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { RepairStatusEventRow } from '../../../lib/repair-status-events.js';
import { RepairTimeline } from './RepairTimeline.js';

function event(over: Partial<RepairStatusEventRow> = {}): RepairStatusEventRow {
  return {
    id: 'ev1',
    fromStatus: 'new',
    toStatus: 'triaged',
    actorUserId: null,
    notes: null,
    createdAt: new Date('2026-06-09T11:00:00.000Z'),
    ...over,
  };
}

describe('RepairTimeline', () => {
  it('renders an empty state when there is no history', () => {
    render(<RepairTimeline events={[]} />);
    expect(screen.getByText('No status changes yet.')).toBeInTheDocument();
  });

  it('renders each transition with from → to labels and any notes', () => {
    render(
      <RepairTimeline
        events={[
          event({
            id: 'a',
            fromStatus: 'triaged',
            toStatus: 'rejected',
            notes: 'Tenant-caused damage.',
          }),
          event({ id: 'b', fromStatus: null, toStatus: 'new' }),
        ]}
      />,
    );
    expect(screen.getByText('Triaged')).toBeInTheDocument();
    expect(screen.getByText('Rejected')).toBeInTheDocument();
    expect(screen.getByText('Tenant-caused damage.')).toBeInTheDocument();
    // the first-ever event (no prior status) renders just the new status
    expect(screen.getByText('New')).toBeInTheDocument();
  });
});
