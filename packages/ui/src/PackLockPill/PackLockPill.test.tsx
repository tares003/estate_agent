// responsive-coverage: opt-out all — PackLockPill is a fixed-height fluid-width atom; responsive layout is verified where it composes into page/organism tests
import { createRef } from 'react';
import axe from 'axe-core';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PackLockPill } from './PackLockPill.js';

describe('PackLockPill', () => {
  it('renders the pack name as visible text', () => {
    render(<PackLockPill packName="Sales-plus" />);
    expect(screen.getByText('Sales-plus')).toBeInTheDocument();
  });

  it('renders the base pill class', () => {
    render(<PackLockPill packName="Sales-plus" data-testid="pill" />);
    expect(screen.getByTestId('pill')).toHaveClass('lockpill');
  });

  it('renders a non-interactive <span> when neither href nor onClick is given', () => {
    render(<PackLockPill packName="Sales-plus" data-testid="pill" />);
    expect(screen.getByTestId('pill').tagName).toBe('SPAN');
  });

  it('conveys the locked state in the accessible name, beyond the icon', () => {
    render(<PackLockPill packName="Sales-plus" />);
    // The accessible name must carry "requires upgrade" so the lock is not
    // conveyed by the (decorative) icon alone.
    expect(screen.getByLabelText('Sales-plus — requires upgrade')).toBeInTheDocument();
  });

  it('marks the lock glyph as decorative (aria-hidden)', () => {
    const { container } = render(<PackLockPill packName="Sales-plus" />);
    const icon = container.querySelector('svg');
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders a <button> and fires onClick when an onClick handler is given', () => {
    const onClick = vi.fn();
    render(<PackLockPill packName="Sales-plus" onClick={onClick} />);
    const pill = screen.getByRole('button', {
      name: 'Sales-plus — requires upgrade',
    });
    expect(pill.tagName).toBe('BUTTON');
    expect(pill).toHaveAttribute('type', 'button');
    fireEvent.click(pill);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders an anchor to the upgrade path when an href is given', () => {
    render(<PackLockPill packName="Sales-plus" href="/admin/packs/sales-plus" />);
    const link = screen.getByRole('link', {
      name: 'Sales-plus — requires upgrade',
    });
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/admin/packs/sales-plus');
  });

  it('renders an anchor that still fires onClick when both href and onClick are given', () => {
    const onClick = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    render(<PackLockPill packName="Sales-plus" href="/admin/packs/sales-plus" onClick={onClick} />);
    const link = screen.getByRole('link', {
      name: 'Sales-plus — requires upgrade',
    });
    expect(link).toHaveAttribute('href', '/admin/packs/sales-plus');
    fireEvent.click(link);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('defaults to the md size class', () => {
    render(<PackLockPill packName="Sales-plus" data-testid="pill" />);
    expect(screen.getByTestId('pill')).toHaveClass('lockpill', 'md');
  });

  it.each(['sm', 'md'] as const)('applies the %s size class', (size) => {
    render(<PackLockPill packName="Sales-plus" size={size} data-testid="pill" />);
    expect(screen.getByTestId('pill')).toHaveClass(size);
  });

  it('lets a caller override the accessible name with an explicit aria-label', () => {
    render(<PackLockPill packName="Sales-plus" aria-label="Sales-plus pack — upgrade to unlock" />);
    expect(screen.getByLabelText('Sales-plus pack — upgrade to unlock')).toBeInTheDocument();
  });

  it('merges a custom className and forwards arbitrary attributes (span)', () => {
    render(<PackLockPill packName="Sales-plus" className="extra" data-testid="pill" title="tip" />);
    const pill = screen.getByTestId('pill');
    expect(pill).toHaveClass('lockpill', 'md', 'extra');
    expect(pill).toHaveAttribute('title', 'tip');
  });

  it('forwards a ref to the underlying span element', () => {
    const ref = createRef<HTMLSpanElement>();
    render(<PackLockPill packName="Sales-plus" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
  });

  it('forwards a ref to the underlying button element when interactive', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<PackLockPill packName="Sales-plus" onClick={() => {}} ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('forwards a ref to the underlying anchor element when linked', () => {
    const ref = createRef<HTMLAnchorElement>();
    render(<PackLockPill packName="Sales-plus" href="/x" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLAnchorElement);
  });

  // axe's colour-contrast rule needs real layout + canvas, which jsdom does not
  // provide; it is disabled here (and verified instead in the Playwright + axe
  // visual suite where the real browser renders the token colours). Structural
  // a11y rules (roles, names, aria) run fully in jsdom.
  const axeOptions = { rules: { 'color-contrast': { enabled: false } } } as const;

  it('has no detectable axe-core accessibility violations (span)', async () => {
    const { container } = render(<PackLockPill packName="Sales-plus" />);
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });

  it('has no detectable axe-core accessibility violations (button)', async () => {
    const { container } = render(<PackLockPill packName="Commercial" onClick={() => {}} />);
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });

  it('has no detectable axe-core accessibility violations (link)', async () => {
    const { container } = render(
      // `onClick` swallows the navigation so jsdom does not warn about its
      // unimplemented top-level navigation when the link is exercised.
      <PackLockPill
        packName="Automation"
        href="/admin/packs/automation"
        onClick={(e) => e.preventDefault()}
      />,
    );
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });
});
