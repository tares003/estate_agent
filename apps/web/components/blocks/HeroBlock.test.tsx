// responsive-coverage: opt-out all — block composition test; responsive layout is
// the design-canvas / page-level e2e concern (design-requirements §3).
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeroBlock, heroBlockSchema } from './HeroBlock.js';

describe('HeroBlock', () => {
  it('renders eyebrow, title, description and a CTA anchor (not a nested button)', () => {
    render(
      <HeroBlock
        data={{
          eyebrow: 'Selling',
          title: 'Sell with confidence',
          description: 'Local experts.',
          ctaLabel: 'Book a valuation',
          ctaHref: '/sell',
        }}
      />,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Sell with confidence' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Selling')).toBeInTheDocument();
    const cta = screen.getByRole('link', { name: /Book a valuation/ });
    expect(cta).toHaveAttribute('href', '/sell');
    expect(screen.queryByRole('button')).toBeNull(); // CTA is an anchor, not a button
  });

  it('omits the optional eyebrow / description / CTA when absent', () => {
    render(<HeroBlock data={{ title: 'Just a title' }} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Just a title' })).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('schema requires a title', () => {
    expect(heroBlockSchema.safeParse({}).success).toBe(false);
    expect(heroBlockSchema.safeParse({ title: 'x' }).success).toBe(true);
  });
});
