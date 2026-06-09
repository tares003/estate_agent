// responsive-coverage: opt-out all — block composition test; responsive layout is
// the design-canvas / page-level e2e concern (design-requirements §3).
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { TestimonialsBlock, testimonialsBlockSchema } from './TestimonialsBlock.js';

describe('TestimonialsBlock', () => {
  it('renders each quote with its author, and the optional role', () => {
    render(
      <TestimonialsBlock
        data={{
          heading: 'What our clients say',
          testimonials: [
            { quote: 'Sold in a week.', author: 'A. Vendor', role: 'Seller' },
            { quote: 'Smooth letting.', author: 'B. Landlord' },
          ],
        }}
      />,
    );
    expect(screen.getByText(/Sold in a week\./)).toBeInTheDocument();
    expect(screen.getByText('A. Vendor')).toBeInTheDocument();
    expect(screen.getByText('Seller')).toBeInTheDocument();
    expect(screen.getByText('B. Landlord')).toBeInTheDocument();
  });

  it('renders quotes as blockquotes (semantic)', () => {
    const { container } = render(
      <TestimonialsBlock data={{ testimonials: [{ quote: 'Great.', author: 'X' }] }} />,
    );
    expect(container.querySelectorAll('blockquote')).toHaveLength(1);
  });

  it('schema requires >=1 testimonial with quote + author (role optional)', () => {
    expect(testimonialsBlockSchema.safeParse({ testimonials: [] }).success).toBe(false);
    expect(
      testimonialsBlockSchema.safeParse({ testimonials: [{ quote: 'q', author: 'a' }] }).success,
    ).toBe(true);
    expect(testimonialsBlockSchema.safeParse({ testimonials: [{ quote: 'q' }] }).success).toBe(
      false,
    );
  });
});
