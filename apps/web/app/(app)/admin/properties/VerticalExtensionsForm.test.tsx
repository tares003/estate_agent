// responsive-coverage: opt-out all — asserts the per-vertical fieldset pack-gating +
// which extension inputs render for which listing type; layout is the admin-routes
// Playwright pass (design-requirements §3).
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { VerticalExtensionsForm } from './VerticalExtensionsForm.js';

// EPIC-F FR-F-3 — the per-vertical extension subsections (new home / commercial /
// business transfer / care home). Each subsection is gated behind its pack (EPIC-AD,
// G12): the fieldset only renders when the owning pack is enabled AND the current
// listing type matches. A residential listing surfaces none of them.

const NEW_HOME_PACK = ['new_homes'];
const COMMERCIAL_PACK = ['commercial'];
const BUSINESS_PACK = ['business_transfer'];
const CARE_PACK = ['care_homes'];
const ALL_PACKS = ['new_homes', 'commercial', 'business_transfer', 'care_homes'];

describe('VerticalExtensionsForm — pack + listing-type gating', () => {
  it('renders nothing for a residential listing even with every pack enabled', () => {
    const { container } = render(
      <VerticalExtensionsForm listingType="residential" enabledPacks={ALL_PACKS} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the new-home subsection for a new_home listing when the pack is on', () => {
    render(<VerticalExtensionsForm listingType="new_home" enabledPacks={NEW_HOME_PACK} />);
    expect(screen.getByText('New home')).toBeInTheDocument();
    expect(screen.getByLabelText(/Development name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Off-plan/i)).toBeInTheDocument();
  });

  it('hides the new-home subsection when the new_homes pack is not enabled', () => {
    render(<VerticalExtensionsForm listingType="new_home" enabledPacks={[]} />);
    expect(screen.queryByText('New home')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Development name/i)).not.toBeInTheDocument();
  });

  it('renders the commercial subsection for a commercial listing when the pack is on', () => {
    render(<VerticalExtensionsForm listingType="commercial" enabledPacks={COMMERCIAL_PACK} />);
    expect(screen.getByText('Commercial')).toBeInTheDocument();
    expect(screen.getByLabelText(/Use class/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/business rates/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/VAT payable/i)).toBeInTheDocument();
  });

  it('renders the business-transfer subsection for a business_transfer listing', () => {
    render(<VerticalExtensionsForm listingType="business_transfer" enabledPacks={BUSINESS_PACK} />);
    expect(screen.getByText('Business transfer')).toBeInTheDocument();
    expect(screen.getByLabelText(/Annual turnover/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Net profit/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Confidential/i)).toBeInTheDocument();
  });

  it('renders the care-home subsection for a care_home listing when the pack is on', () => {
    render(<VerticalExtensionsForm listingType="care_home" enabledPacks={CARE_PACK} />);
    expect(screen.getByText('Care home')).toBeInTheDocument();
    expect(screen.getByLabelText(/Bed count/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/CQC rating/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Going concern/i)).toBeInTheDocument();
  });

  it('shows only the subsection matching the listing type, not the others', () => {
    render(<VerticalExtensionsForm listingType="commercial" enabledPacks={ALL_PACKS} />);
    expect(screen.getByText('Commercial')).toBeInTheDocument();
    expect(screen.queryByText('Care home')).not.toBeInTheDocument();
    expect(screen.queryByText('Business transfer')).not.toBeInTheDocument();
    expect(screen.queryByText('New home')).not.toBeInTheDocument();
  });

  it('pre-fills the extension fields from the initial values in edit mode', () => {
    render(
      <VerticalExtensionsForm
        listingType="care_home"
        enabledPacks={CARE_PACK}
        initial={{ bedCount: 42, cqcRating: 'good', cqcInspectionUrl: null, isGoingConcern: true }}
      />,
    );
    expect(screen.getByLabelText(/Bed count/i)).toHaveValue(42);
    expect(screen.getByLabelText(/CQC rating/i)).toHaveValue('good');
    expect(screen.getByLabelText(/Going concern/i)).toBeChecked();
  });
});
