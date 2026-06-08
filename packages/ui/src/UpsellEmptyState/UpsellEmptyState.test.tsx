// responsive-coverage: opt-out all — UpsellEmptyState is a fluid single-column
// block; its responsive layout is verified where it composes into page/organism
// tests (the locked-admin-section surfaces per design-requirements §2a.1).
import { createRef } from 'react';
import axe from 'axe-core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UpsellEmptyState } from './UpsellEmptyState.js';

/** Deterministic fixture props for the `sales_plus` pack upsell. */
const fixture = {
  packName: 'Sales-plus',
  title: 'Unlock the vendor portal',
  description: 'Manage vendors, instructions and offers from one place.',
  ctaLabel: 'Enable for £29 / month',
} as const;

describe('UpsellEmptyState', () => {
  it('renders the title as a heading', () => {
    render(<UpsellEmptyState {...fixture} onCta={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Unlock the vendor portal' })).toBeInTheDocument();
  });

  it('renders the description text', () => {
    render(<UpsellEmptyState {...fixture} onCta={vi.fn()} />);
    expect(
      screen.getByText('Manage vendors, instructions and offers from one place.'),
    ).toBeInTheDocument();
  });

  it('renders the pack name', () => {
    render(<UpsellEmptyState {...fixture} onCta={vi.fn()} />);
    expect(screen.getByText('Sales-plus')).toBeInTheDocument();
  });

  it('exposes a labelled region named by the title (G9)', () => {
    render(<UpsellEmptyState {...fixture} onCta={vi.fn()} />);
    // The region's accessible name comes from the heading via aria-labelledby.
    expect(screen.getByRole('region', { name: 'Unlock the vendor portal' })).toBeInTheDocument();
  });

  it('renders the base class on the region', () => {
    render(<UpsellEmptyState {...fixture} onCta={vi.fn()} />);
    expect(screen.getByRole('region')).toHaveClass('upsell-empty');
  });

  it('renders the CTA as a real button when onCta is given', () => {
    render(<UpsellEmptyState {...fixture} onCta={vi.fn()} />);
    const cta = screen.getByRole('button', { name: 'Enable for £29 / month' });
    expect(cta.tagName).toBe('BUTTON');
  });

  it('fires onCta when the button CTA is activated', async () => {
    const onCta = vi.fn();
    const user = userEvent.setup();
    render(<UpsellEmptyState {...fixture} onCta={onCta} />);
    await user.click(screen.getByRole('button', { name: 'Enable for £29 / month' }));
    expect(onCta).toHaveBeenCalledTimes(1);
  });

  it('fires onCta on keyboard activation (Enter)', async () => {
    const onCta = vi.fn();
    const user = userEvent.setup();
    render(<UpsellEmptyState {...fixture} onCta={onCta} />);
    const cta = screen.getByRole('button', { name: 'Enable for £29 / month' });
    cta.focus();
    await user.keyboard('{Enter}');
    expect(onCta).toHaveBeenCalledTimes(1);
  });

  it('renders the CTA as a real link when ctaHref is given', () => {
    render(<UpsellEmptyState {...fixture} ctaHref="/admin/plan?enable=sales_plus" />);
    const cta = screen.getByRole('link', { name: 'Enable for £29 / month' });
    expect(cta.tagName).toBe('A');
    expect(cta).toHaveAttribute('href', '/admin/plan?enable=sales_plus');
  });

  it('the link CTA carries the Button atom visual class for design fidelity (G7)', () => {
    render(<UpsellEmptyState {...fixture} ctaHref="/upgrade" />);
    // Reuses the Button atom's class contract so the link reads as a primary CTA.
    expect(screen.getByRole('link', { name: 'Enable for £29 / month' })).toHaveClass(
      'btn',
      'primary',
    );
  });

  it('prefers the link CTA when both ctaHref and onCta are supplied', () => {
    // ctaHref is the navigational, share-able affordance; it wins.
    render(<UpsellEmptyState {...fixture} ctaHref="/upgrade" onCta={vi.fn()} />);
    expect(screen.getByRole('link', { name: 'Enable for £29 / month' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Enable for £29 / month' }),
    ).not.toBeInTheDocument();
  });

  it('renders an optional decorative icon hidden from assistive technology', () => {
    const { container } = render(
      <UpsellEmptyState {...fixture} onCta={vi.fn()} icon={<svg data-testid="pack-icon" />} />,
    );
    const iconWrap = container.querySelector('.upsell-empty__icon');
    expect(iconWrap).toBeInTheDocument();
    expect(iconWrap).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('pack-icon')).toBeInTheDocument();
  });

  it('omits the icon wrapper when no icon is supplied', () => {
    const { container } = render(<UpsellEmptyState {...fixture} onCta={vi.fn()} />);
    expect(container.querySelector('.upsell-empty__icon')).not.toBeInTheDocument();
  });

  it('forwards a ref to the underlying region element', () => {
    const ref = createRef<HTMLElement>();
    render(<UpsellEmptyState {...fixture} onCta={vi.fn()} ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLElement);
    expect(ref.current).toHaveClass('upsell-empty');
  });

  it('forwards arbitrary attributes and merges a custom className', () => {
    render(
      <UpsellEmptyState {...fixture} onCta={vi.fn()} className="extra" data-testid="upsell" />,
    );
    const region = screen.getByTestId('upsell');
    expect(region).toHaveClass('upsell-empty', 'extra');
  });

  // axe's colour-contrast rule needs real layout + canvas, which jsdom does not
  // provide; it is disabled here (and verified instead in the Playwright + axe
  // visual suite). Structural a11y rules (roles, names, region labelling) run
  // fully in jsdom.
  const axeOptions = { rules: { 'color-contrast': { enabled: false } } } as const;

  it('has no detectable axe-core violations (button CTA)', async () => {
    const { container } = render(<UpsellEmptyState {...fixture} onCta={vi.fn()} />);
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });

  it('has no detectable axe-core violations (link CTA + icon)', async () => {
    const { container } = render(
      <UpsellEmptyState {...fixture} ctaHref="/upgrade" icon={<svg aria-hidden="true" />} />,
    );
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });
});
