// responsive-coverage: opt-out all — asserts the compute/format behaviour, the
// per-band breakdown + the FR-W-4/10 disclosures; responsive layout is the
// page-level Playwright pass (design-requirements §3).
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StampDutyCalculator } from './StampDutyCalculator.js';

// EPIC-W FR-W-2/4/10 — the indicative Stamp Duty calculator UI. Computes live from
// the DEFAULT_SDLT_CONFIG (an illustrative, operator-configurable band set); the
// figures here follow from that config, not from any assertion about the law. It
// MUST show the "not financial advice" disclosure (FR-W-10) and the bands'
// last-updated date (FR-W-4).

describe('StampDutyCalculator', () => {
  it('shows the indicative total for the default inputs (home mover, £300k)', () => {
    render(<StampDutyCalculator />);
    // DEFAULT bands: 0% to £250k, 5% above → 5% of £50k = £2,500.
    expect(screen.getByTestId('total-tax').textContent).toMatch(/£2,500\.00/);
  });

  it('renders the "not financial advice" disclosure and the bands last-updated date', () => {
    render(<StampDutyCalculator />);
    expect(screen.getByText(/not financial advice/i)).toBeInTheDocument();
    expect(screen.getByText(/last updated/i)).toBeInTheDocument();
  });

  it('applies first-time-buyer relief when the category changes', () => {
    render(<StampDutyCalculator />);
    fireEvent.change(screen.getByLabelText(/buyer/i), { target: { value: 'first_time_buyer' } });
    // FTB relief: 0% to £425k → £0 on a £300k purchase.
    expect(screen.getByTestId('total-tax').textContent).toMatch(/£0\.00/);
  });

  it('shows a per-band breakdown of the tax', () => {
    render(<StampDutyCalculator />);
    // At least the two bands a £300k home-mover purchase spans.
    const rows = screen.getAllByTestId('sdlt-band');
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });
});
