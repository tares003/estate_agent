// responsive-coverage: opt-out all — Spinner is a fixed-height fluid-width atom; responsive layout is verified where it composes into page/organism tests
import { createRef } from 'react';
import axe from 'axe-core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Spinner } from './Spinner.js';

describe('Spinner', () => {
  it('renders with role="status" so assistive tech announces it', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('exposes a default accessible name of "Loading"', () => {
    render(<Spinner />);
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });

  it('renders visually-hidden text so the status is conveyed by more than colour', () => {
    render(<Spinner />);
    // The accessible name is backed by real text, not an aria-label only,
    // so screen readers and the a11y tree both surface it.
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });

  it('honours a custom label', () => {
    render(<Spinner label="Saving property" />);
    expect(screen.getByRole('status', { name: 'Saving property' })).toBeInTheDocument();
    expect(screen.queryByText('Loading')).not.toBeInTheDocument();
  });

  it('defaults to the md size class', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toHaveClass('spinner', 'md');
  });

  it.each(['sm', 'md', 'lg'] as const)('applies the %s size class', (size) => {
    render(<Spinner size={size} />);
    expect(screen.getByRole('status')).toHaveClass(size);
  });

  it('marks the spinning visual as decorative (aria-hidden)', () => {
    render(<Spinner />);
    const status = screen.getByRole('status');
    const visual = status.querySelector('[aria-hidden="true"]');
    expect(visual).not.toBeNull();
  });

  it('forwards a ref to the underlying element', () => {
    const ref = createRef<HTMLSpanElement>();
    render(<Spinner ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
  });

  it('merges a custom className and forwards arbitrary attributes', () => {
    render(<Spinner className="extra" data-testid="busy" />);
    const status = screen.getByTestId('busy');
    expect(status).toHaveClass('spinner', 'md', 'extra');
    expect(status).toHaveAttribute('role', 'status');
  });

  it('lets a caller suppress the built-in label when labelling externally', () => {
    // When aria-labelledby points elsewhere, the visually-hidden text is omitted
    // so the name is not announced twice.
    render(
      <>
        <span id="ext-label">Uploading documents</span>
        <Spinner aria-labelledby="ext-label" label={null} data-testid="busy" />
      </>,
    );
    const status = screen.getByTestId('busy');
    expect(status).toHaveAttribute('aria-labelledby', 'ext-label');
    expect(screen.queryByText('Loading')).not.toBeInTheDocument();
  });

  // axe's colour-contrast rule needs real layout + canvas, which jsdom does not
  // provide; it is disabled here (and verified instead in the Playwright + axe
  // visual suite where the real browser renders the token colours). Structural
  // a11y rules (roles, names, aria) run fully in jsdom.
  const axeOptions = { rules: { 'color-contrast': { enabled: false } } } as const;

  it('has no detectable axe-core accessibility violations', async () => {
    const { container } = render(<Spinner />);
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });

  it('a custom-labelled spinner has no detectable axe-core violations', async () => {
    const { container } = render(<Spinner size="lg" label="Loading properties" />);
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });
});
