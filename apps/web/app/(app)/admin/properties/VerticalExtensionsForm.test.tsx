// responsive-coverage: opt-out all — asserts the per-vertical fieldset pack-gating +
// which extension inputs render for which listing type; layout is the admin-routes
// Playwright pass (design-requirements §3).
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { VerticalExtensionsForm } from './VerticalExtensionsForm.js';

// EPIC-F FR-F-3 — the per-vertical extension subsections (new home / commercial /
// business transfer / care home). Each subsection renders only when its listing type is
// in the server-resolved authorable-verticals allow-list (EPIC-AD entitlement decided
// upstream via isPackEnabled; this component never names a pack slug). A residential
// listing surfaces none of them.

const ALL_VERTICALS = ['new_home', 'commercial', 'business_transfer', 'care_home'];

describe('VerticalExtensionsForm — vertical allow-list gating', () => {
  it('renders nothing for a residential listing even when every vertical is authorable', () => {
    const { container } = render(
      <VerticalExtensionsForm listingType="residential" enabledVerticals={ALL_VERTICALS} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the new-home subsection for a new_home listing when it is authorable', () => {
    render(<VerticalExtensionsForm listingType="new_home" enabledVerticals={['new_home']} />);
    expect(screen.getByText('New home details')).toBeInTheDocument();
    expect(screen.getByLabelText(/Development name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Off-plan/i)).toBeInTheDocument();
  });

  it('hides the new-home subsection when the vertical is not authorable', () => {
    render(<VerticalExtensionsForm listingType="new_home" enabledVerticals={[]} />);
    expect(screen.queryByText('New home details')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Development name/i)).not.toBeInTheDocument();
  });

  it('renders the commercial subsection for a commercial listing when it is authorable', () => {
    render(<VerticalExtensionsForm listingType="commercial" enabledVerticals={['commercial']} />);
    expect(screen.getByText('Commercial details')).toBeInTheDocument();
    expect(screen.getByLabelText(/Use class/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/business rates/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/VAT payable/i)).toBeInTheDocument();
  });

  it('renders the business-transfer subsection for a business_transfer listing', () => {
    render(
      <VerticalExtensionsForm
        listingType="business_transfer"
        enabledVerticals={['business_transfer']}
      />,
    );
    expect(screen.getByText('Business transfer details')).toBeInTheDocument();
    expect(screen.getByLabelText(/Annual turnover/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Net profit/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Confidential/i)).toBeInTheDocument();
  });

  it('renders the care-home subsection for a care_home listing when it is authorable', () => {
    render(<VerticalExtensionsForm listingType="care_home" enabledVerticals={['care_home']} />);
    expect(screen.getByText('Care home details')).toBeInTheDocument();
    expect(screen.getByLabelText(/Bed count/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/CQC rating/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Going concern/i)).toBeInTheDocument();
  });

  it('shows only the subsection matching the listing type, not the others', () => {
    render(<VerticalExtensionsForm listingType="commercial" enabledVerticals={ALL_VERTICALS} />);
    expect(screen.getByText('Commercial details')).toBeInTheDocument();
    expect(screen.queryByText('Care home details')).not.toBeInTheDocument();
    expect(screen.queryByText('Business transfer details')).not.toBeInTheDocument();
    expect(screen.queryByText('New home details')).not.toBeInTheDocument();
  });

  it('pre-fills the extension fields from the initial values in edit mode', () => {
    render(
      <VerticalExtensionsForm
        listingType="care_home"
        enabledVerticals={['care_home']}
        initial={{ bedCount: 42, cqcRating: 'good', cqcInspectionUrl: null, isGoingConcern: true }}
      />,
    );
    expect(screen.getByLabelText(/Bed count/i)).toHaveValue(42);
    expect(screen.getByLabelText(/CQC rating/i)).toHaveValue('good');
    expect(screen.getByLabelText(/Going concern/i)).toBeChecked();
  });

  it('pairs each vertical checkbox with a hidden `false` companion so unticking clears it (FR-F-3)', () => {
    const { container } = render(
      <VerticalExtensionsForm listingType="care_home" enabledVerticals={['care_home']} />,
    );
    // A bare checkbox posts nothing when unticked, which would leave a previously-true
    // flag unchanged on edit. The hidden companion always posts "false"; the checkbox's
    // own "on" overrides it (last value wins) when ticked.
    const hidden = container.querySelector('input[type="hidden"][name="isGoingConcern"]');
    expect(hidden).not.toBeNull();
    expect(hidden).toHaveValue('false');
    expect(screen.getByLabelText(/Going concern/i)).toHaveAttribute('name', 'isGoingConcern');
  });
});
