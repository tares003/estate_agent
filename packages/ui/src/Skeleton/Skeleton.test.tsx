// responsive-coverage: opt-out all — Skeleton is a viewport-invariant loading
// placeholder; its dimensions are driven by the layout it mirrors, so responsive
// behaviour is verified where it composes into page/organism tests.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRef } from 'react';
import axe from 'axe-core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Skeleton } from './Skeleton.js';

// The reduced-motion fallback and shimmer live entirely in the stylesheet, and
// vitest runs with `css: false`, so structural behaviour is asserted in jsdom
// and the motion contract is asserted against the CSS source directly.
// Built from cwd (the package root, where vitest runs) so Vite never tries to
// resolve it as a `.css` module import.
const cssSource = readFileSync(join(process.cwd(), 'src', 'Skeleton', 'Skeleton.css'), 'utf8');

describe('Skeleton', () => {
  it('exposes an accessible loading affordance via role="status"', () => {
    render(<Skeleton />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('has a default accessible name of "Loading"', () => {
    render(<Skeleton />);
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });

  it('backs the loading affordance with real visually-hidden text (not colour alone)', () => {
    render(<Skeleton />);
    // The status text is backed by actual text in the a11y tree (G9), not an
    // aria-label-only signal.
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });

  it('honours a custom label', () => {
    render(<Skeleton label="Loading properties" />);
    expect(screen.getByRole('status', { name: 'Loading properties' })).toBeInTheDocument();
    expect(screen.queryByText('Loading')).not.toBeInTheDocument();
  });

  it('lets a caller suppress the built-in label when labelling externally', () => {
    render(
      <>
        <span id="ext">Loading the dashboard</span>
        <Skeleton aria-labelledby="ext" label={null} data-testid="sk" />
      </>,
    );
    const status = screen.getByTestId('sk');
    expect(status).toHaveAttribute('aria-labelledby', 'ext');
    expect(screen.queryByText('Loading')).not.toBeInTheDocument();
  });

  it('marks the busy region with aria-busy', () => {
    render(<Skeleton />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });

  it('renders the decorative placeholders as aria-hidden so AT skips them', () => {
    render(<Skeleton data-testid="sk" />);
    const status = screen.getByTestId('sk');
    const placeholders = status.querySelectorAll('[aria-hidden="true"]');
    expect(placeholders.length).toBeGreaterThan(0);
  });

  it('defaults to the text variant', () => {
    render(<Skeleton data-testid="sk" />);
    expect(screen.getByTestId('sk')).toHaveClass('skeleton', 'text');
  });

  it.each(['text', 'rect', 'circle'] as const)('applies the %s variant class', (variant) => {
    render(<Skeleton variant={variant} data-testid="sk" />);
    expect(screen.getByTestId('sk')).toHaveClass(variant);
  });

  it('renders a single placeholder line for the text variant by default', () => {
    render(<Skeleton variant="text" data-testid="sk" />);
    const lines = screen.getByTestId('sk').querySelectorAll('.skeleton-line');
    expect(lines).toHaveLength(1);
  });

  it('renders the requested number of lines for the text variant', () => {
    render(<Skeleton variant="text" lines={4} data-testid="sk" />);
    const lines = screen.getByTestId('sk').querySelectorAll('.skeleton-line');
    expect(lines).toHaveLength(4);
  });

  it('clamps a non-positive line count to a single line', () => {
    render(<Skeleton variant="text" lines={0} data-testid="sk" />);
    const lines = screen.getByTestId('sk').querySelectorAll('.skeleton-line');
    expect(lines).toHaveLength(1);
  });

  it('ignores the lines prop for non-text variants', () => {
    render(<Skeleton variant="rect" lines={5} data-testid="sk" />);
    const lines = screen.getByTestId('sk').querySelectorAll('.skeleton-line');
    expect(lines).toHaveLength(0);
  });

  it('renders a single decorative shape for the rect variant', () => {
    render(<Skeleton variant="rect" data-testid="sk" />);
    const shapes = screen.getByTestId('sk').querySelectorAll('.skeleton-shape');
    expect(shapes).toHaveLength(1);
  });

  it('renders a single decorative shape for the circle variant', () => {
    render(<Skeleton variant="circle" data-testid="sk" />);
    const shapes = screen.getByTestId('sk').querySelectorAll('.skeleton-shape');
    expect(shapes).toHaveLength(1);
  });

  it('applies a consumer-passed width and height as inline style on the placeholder', () => {
    render(<Skeleton variant="rect" width="200px" height="120px" data-testid="sk" />);
    const shape = screen.getByTestId('sk').querySelector('.skeleton-shape') as HTMLElement;
    expect(shape.style.width).toBe('200px');
    expect(shape.style.height).toBe('120px');
  });

  it('accepts numeric width/height and applies them verbatim as inline style', () => {
    render(<Skeleton variant="circle" width={48} height={48} data-testid="sk" />);
    const shape = screen.getByTestId('sk').querySelector('.skeleton-shape') as HTMLElement;
    expect(shape.style.width).toBe('48px');
    expect(shape.style.height).toBe('48px');
  });

  it('applies width to each text line when supplied', () => {
    render(<Skeleton variant="text" lines={2} width="80%" data-testid="sk" />);
    const lines = Array.from(
      screen.getByTestId('sk').querySelectorAll<HTMLElement>('.skeleton-line'),
    );
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(line.style.width).toBe('80%');
    }
  });

  it('does not set an inline width/height when none is supplied (uses tokens)', () => {
    render(<Skeleton variant="rect" data-testid="sk" />);
    const shape = screen.getByTestId('sk').querySelector('.skeleton-shape') as HTMLElement;
    expect(shape.style.width).toBe('');
    expect(shape.style.height).toBe('');
  });

  it('forwards a ref to the underlying element', () => {
    const ref = createRef<HTMLDivElement>();
    render(<Skeleton ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it('merges a custom className and forwards arbitrary attributes', () => {
    render(<Skeleton className="extra" data-testid="sk" />);
    const status = screen.getByTestId('sk');
    expect(status).toHaveClass('skeleton', 'text', 'extra');
    expect(status).toHaveAttribute('role', 'status');
  });

  // --- Motion contract (asserted against the CSS source; css:false in jsdom) ---

  it('drives the shimmer from motion + colour tokens, never raw values (G7)', () => {
    // The animated placeholder references a motion-duration token and an easing
    // token, and the surface colour comes from a colour token.
    expect(cssSource).toMatch(/animation:[^;]*var\(--motion-duration-[a-z]+\)/);
    expect(cssSource).toMatch(/var\(--motion-ease-[a-z]+\)/);
    expect(cssSource).toMatch(/var\(--colour-surface-sunken\)/);
    // No raw hex / px / ms / easing literals.
    expect(cssSource).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(cssSource).not.toMatch(/\b[0-9.]+ms\b/);
  });

  it('disables the shimmer under prefers-reduced-motion (no animated motion)', () => {
    expect(cssSource).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    // Inside the reduced-motion block the animation is switched off.
    const reducedBlock = cssSource.slice(cssSource.indexOf('prefers-reduced-motion'));
    expect(reducedBlock).toMatch(/animation:\s*none/);
  });

  // --- axe ---

  // axe's colour-contrast rule needs real layout + canvas, which jsdom lacks; it
  // is disabled here and verified in the Playwright + axe visual suite. Structural
  // a11y rules (roles, names, aria) run fully in jsdom.
  const axeOptions = { rules: { 'color-contrast': { enabled: false } } } as const;

  it('has no detectable axe-core violations (text variant)', async () => {
    const { container } = render(<Skeleton variant="text" lines={3} />);
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });

  it('has no detectable axe-core violations (rect variant, custom label)', async () => {
    const { container } = render(<Skeleton variant="rect" label="Loading the property gallery" />);
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });

  it('has no detectable axe-core violations (circle variant)', async () => {
    const { container } = render(<Skeleton variant="circle" width={64} height={64} />);
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });
});
