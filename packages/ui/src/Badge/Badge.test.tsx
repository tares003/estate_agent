// responsive-coverage: opt-out all — Badge is a fixed-height fluid-width atom; responsive layout is verified where it composes into page/organism tests
import { createRef } from 'react';
import axe from 'axe-core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from './Badge.js';

describe('Badge', () => {
  it('renders its children as visible text', () => {
    render(<Badge>For sale</Badge>);
    expect(screen.getByText('For sale')).toBeInTheDocument();
  });

  it('renders the base badge class', () => {
    render(<Badge>Draft</Badge>);
    expect(screen.getByText('Draft')).toHaveClass('badge');
  });

  it('defaults to the neutral tone', () => {
    render(<Badge>Draft</Badge>);
    expect(screen.getByText('Draft')).toHaveClass('neutral');
  });

  it.each([
    'neutral',
    'success',
    'warning',
    'danger',
    'info',
    'available',
    'under-offer',
    'sold-stc',
    'sold',
    'let-agreed',
    'let',
    'withdrawn',
  ] as const)('applies the %s tone class', (tone) => {
    render(<Badge tone={tone}>Label</Badge>);
    expect(screen.getByText('Label')).toHaveClass(tone);
  });

  it('renders a decorative status dot for market-status tones', () => {
    const { container } = render(
      <Badge tone="available" aria-label="Status: available">
        For sale
      </Badge>,
    );
    const dot = container.querySelector('.dot');
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveAttribute('aria-hidden', 'true');
  });

  it('does not render a status dot for semantic tones', () => {
    const { container } = render(<Badge tone="success">Active</Badge>);
    expect(container.querySelector('.dot')).not.toBeInTheDocument();
  });

  it('does not convey status by colour alone — the visible text carries the meaning', () => {
    // The label "Sold STC" is readable text, independent of the danger fill.
    render(
      <Badge tone="sold-stc" aria-label="Status: sold subject to contract">
        Sold STC
      </Badge>,
    );
    expect(screen.getByText('Sold STC')).toBeInTheDocument();
  });

  it('exposes an explicit aria-label as the accessible name', () => {
    render(
      <Badge tone="under-offer" aria-label="Status: under offer">
        Under offer
      </Badge>,
    );
    expect(screen.getByLabelText('Status: under offer')).toBeInTheDocument();
  });

  it('falls back to the visible text as the accessible name when no aria-label is given', () => {
    render(<Badge tone="let-agreed">Let agreed</Badge>);
    // No aria-label: the text node itself is the accessible name.
    expect(screen.getByText('Let agreed')).not.toHaveAttribute('aria-label');
  });

  it('renders as a <span> by default (non-interactive status)', () => {
    render(<Badge>Withdrawn</Badge>);
    expect(screen.getByText('Withdrawn').tagName).toBe('SPAN');
  });

  it('forwards a ref to the underlying span element', () => {
    const ref = createRef<HTMLSpanElement>();
    render(<Badge ref={ref}>Label</Badge>);
    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
  });

  it('forwards arbitrary attributes and merges a custom className', () => {
    render(
      <Badge tone="info" className="extra" data-testid="badge" title="tip">
        Info
      </Badge>,
    );
    const badge = screen.getByTestId('badge');
    expect(badge).toHaveClass('badge', 'info', 'extra');
    expect(badge).toHaveAttribute('title', 'tip');
  });

  // axe's colour-contrast rule needs real layout + canvas, which jsdom does not
  // provide; it is disabled here (and verified instead in the Playwright + axe
  // visual suite where the real browser renders the token colours). Structural
  // a11y rules (roles, names, aria) run fully in jsdom.
  const axeOptions = { rules: { 'color-contrast': { enabled: false } } } as const;

  it('has no detectable axe-core accessibility violations', async () => {
    const { container } = render(
      <Badge tone="available" aria-label="Status: available">
        For sale
      </Badge>,
    );
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });

  it('a semantic-tone badge has no detectable axe-core accessibility violations', async () => {
    const { container } = render(<Badge tone="danger">Overdue</Badge>);
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });
});
