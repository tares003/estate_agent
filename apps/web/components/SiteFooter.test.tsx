// responsive-coverage: opt-out all — footer content/trust-marker test; the
// responsive footer layout is the design-canvas / page-level e2e concern.
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { SiteFooter } from './SiteFooter.js';

// EPIC-D / trust markers (G8): the public footer carries the indicative-pricing +
// rent-frequency note. Extracted from the public layout so it stays unit-tested
// after the layout became async glue (B24).
describe('SiteFooter', () => {
  it('renders a contentinfo landmark', () => {
    render(<SiteFooter />);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('shows the indicative-pricing / rent-frequency trust note', () => {
    render(<SiteFooter />);
    expect(screen.getByText(/indicative only/i)).toBeInTheDocument();
    expect(screen.getByText(/PCM/)).toBeInTheDocument();
  });
});
