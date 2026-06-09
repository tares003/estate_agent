// responsive-coverage: opt-out all — asserts the timeline content; layout is the
// admin-routes Playwright pass (design-requirements §3).
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { EnquiryStatusEventRow } from '../../../lib/enquiry-status-events.js';
import { EnquiryTimeline } from './EnquiryTimeline.js';

function event(over: Partial<EnquiryStatusEventRow> = {}): EnquiryStatusEventRow {
  return {
    id: 'ev1',
    fromStatus: 'new',
    toStatus: 'contacted',
    changedByAgentId: null,
    changedAt: new Date('2026-06-09T11:00:00.000Z'),
    ...over,
  };
}

describe('EnquiryTimeline', () => {
  it('renders an empty state when there are no events', () => {
    render(<EnquiryTimeline events={[]} />);
    expect(screen.getByText('No status changes yet.')).toBeInTheDocument();
  });

  it('renders each transition with from → to labels', () => {
    render(
      <EnquiryTimeline
        events={[
          event({ id: 'a', fromStatus: 'contacted', toStatus: 'converted' }),
          event({ id: 'b', fromStatus: null, toStatus: 'new' }),
        ]}
      />,
    );
    expect(screen.getByText('Converted')).toBeInTheDocument();
    expect(screen.getByText('Contacted')).toBeInTheDocument();
    // the first-ever event (no prior status) renders just the new status
    expect(screen.getByText('New')).toBeInTheDocument();
  });
});
