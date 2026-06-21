// responsive-coverage: opt-out all — ReviewsBadge is a fixed-height fluid-width
// trust marker; responsive layout is verified where it composes into the footer /
// page-level tests.
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ReviewsBadge } from './ReviewsBadge.js';

// EPIC-AC FR-AC-6 — the live public reviews badge. Presents the tenant's aggregate
// score (average, 1 dp) + total count as a trust marker (G8). Renders NOTHING when
// there is no feedback — never a fabricated score.
describe('ReviewsBadge', () => {
  it('shows the average score, the scale, and the thousands-grouped count', () => {
    render(<ReviewsBadge average={4.9} count={1284} />);
    expect(screen.getByText(/4\.9 \/ 5/)).toBeInTheDocument();
    expect(screen.getByText(/1,284 reviews/)).toBeInTheDocument();
  });

  it('singularises the count when there is exactly one review', () => {
    render(<ReviewsBadge average={5} count={1} />);
    expect(screen.getByText(/1 review\b/)).toBeInTheDocument();
  });

  it('renders nothing when there is no feedback (never a fabricated score)', () => {
    const { container } = render(<ReviewsBadge average={0} count={0} />);
    expect(container).toBeEmptyDOMElement();
  });
});
