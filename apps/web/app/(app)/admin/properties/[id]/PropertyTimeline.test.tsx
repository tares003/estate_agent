// responsive-coverage: opt-out all — asserts the timeline content; layout is the
// admin-routes Playwright pass (design-requirements §3).
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { PropertyStatusEventRow } from '../../../lib/property-status-events.js';
import { PropertyTimeline } from './PropertyTimeline.js';

function event(over: Partial<PropertyStatusEventRow> = {}): PropertyStatusEventRow {
  return {
    id: 'ev1',
    fromStatus: 'for_sale',
    toStatus: 'under_offer',
    changedByAgentId: null,
    changedAt: new Date('2026-06-09T11:00:00.000Z'),
    ...over,
  };
}

describe('PropertyTimeline', () => {
  it('renders an empty state when there are no status changes', () => {
    render(<PropertyTimeline events={[]} />);
    expect(screen.getByText('No status changes yet.')).toBeInTheDocument();
  });

  it('renders each transition with from → to labels, newest-first', () => {
    render(
      <PropertyTimeline
        events={[
          event({ id: 'a', fromStatus: 'under_offer', toStatus: 'sold_stc' }),
          event({ id: 'b', fromStatus: null, toStatus: 'for_sale' }),
        ]}
      />,
    );
    expect(screen.getByText('Under offer')).toBeInTheDocument();
    expect(screen.getByText('Sold STC')).toBeInTheDocument();
    // the first-ever event (no prior status) renders just the new status
    expect(screen.getByText('For sale')).toBeInTheDocument();
  });
});
