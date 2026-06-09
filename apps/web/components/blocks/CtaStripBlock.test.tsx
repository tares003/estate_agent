// responsive-coverage: opt-out all — block composition test; responsive layout is
// the design-canvas / page-level e2e concern (design-requirements §3).
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CtaStripBlock, ctaStripBlockSchema } from './CtaStripBlock.js';

describe('CtaStripBlock', () => {
  it('renders the heading, description and CTA link', () => {
    render(
      <CtaStripBlock
        data={{
          heading: 'Thinking of selling?',
          description: 'Get a free valuation.',
          ctaLabel: 'Request a valuation',
          ctaHref: '/valuation',
        }}
      />,
    );
    expect(
      screen.getByRole('heading', { level: 2, name: 'Thinking of selling?' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Get a free valuation.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Request a valuation/ })).toHaveAttribute(
      'href',
      '/valuation',
    );
  });

  it('schema requires heading, ctaLabel and ctaHref', () => {
    expect(ctaStripBlockSchema.safeParse({ heading: 'h' }).success).toBe(false);
    expect(
      ctaStripBlockSchema.safeParse({ heading: 'h', ctaLabel: 'go', ctaHref: '/x' }).success,
    ).toBe(true);
  });
});
