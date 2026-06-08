// responsive-coverage: opt-out all — Button is a fixed-size atom; responsive layout is verified where it composes into page/organism tests
import { createRef } from 'react';
import axe from 'axe-core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button.js';

describe('Button', () => {
  it('renders its children as the accessible label', () => {
    render(<Button>Book a viewing</Button>);
    expect(screen.getByRole('button', { name: 'Book a viewing' })).toBeInTheDocument();
  });

  it('renders a real <button> element', () => {
    render(<Button>Save changes</Button>);
    expect(screen.getByRole('button').tagName).toBe('BUTTON');
  });

  it('defaults type to "button" (never an implicit submit)', () => {
    render(<Button>Cancel</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('honours an explicit type override', () => {
    render(<Button type="submit">Save changes</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  it('defaults to the primary variant and the md size', () => {
    render(<Button>Default</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('btn', 'primary', 'md');
  });

  it.each(['primary', 'secondary', 'ghost', 'destructive', 'link'] as const)(
    'applies the %s variant class',
    (variant) => {
      render(<Button variant={variant}>Label</Button>);
      expect(screen.getByRole('button')).toHaveClass(variant);
    },
  );

  it.each(['sm', 'md', 'lg'] as const)('applies the %s size class', (size) => {
    render(<Button size={size}>Label</Button>);
    expect(screen.getByRole('button')).toHaveClass(size);
  });

  it('fires onClick when enabled', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>Click me</Button>);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not fire onClick when disabled', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button disabled onClick={onClick}>
        Disabled
      </Button>,
    );
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('shows a busy state and is disabled while loading', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button loading onClick={onClick}>
        Save changes
      </Button>,
    );
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveClass('loading');
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('is not busy when not loading', () => {
    render(<Button>Save changes</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'false');
  });

  it('renders a leading icon before the label, marked decorative', () => {
    render(<Button leftIcon={<svg data-testid="left" />}>Get a free valuation</Button>);
    const icon = screen.getByTestId('left');
    expect(icon).toBeInTheDocument();
    expect(icon.parentElement).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders a trailing icon after the label, marked decorative', () => {
    render(<Button rightIcon={<svg data-testid="right" />}>Next</Button>);
    const icon = screen.getByTestId('right');
    expect(icon).toBeInTheDocument();
    expect(icon.parentElement).toHaveAttribute('aria-hidden', 'true');
  });

  it('hides icons while loading so only the spinner shows', () => {
    render(
      <Button loading leftIcon={<svg data-testid="left" />} rightIcon={<svg data-testid="right" />}>
        Saving
      </Button>,
    );
    expect(screen.queryByTestId('left')).not.toBeInTheDocument();
    expect(screen.queryByTestId('right')).not.toBeInTheDocument();
  });

  it('forwards a ref to the underlying button element', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Label</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('forwards arbitrary button attributes and merges a custom className', () => {
    render(
      <Button className="extra" data-analytics="cta" aria-label="Custom">
        Label
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Custom' });
    expect(button).toHaveClass('btn', 'primary', 'md', 'extra');
    expect(button).toHaveAttribute('data-analytics', 'cta');
  });

  // axe's colour-contrast rule needs real layout + canvas, which jsdom does not
  // provide; it is disabled here (and verified instead in the Playwright + axe
  // visual suite where the real browser renders the token colours). Structural
  // a11y rules (roles, names, aria) run fully in jsdom.
  const axeOptions = { rules: { 'color-contrast': { enabled: false } } } as const;

  it('has no detectable axe-core accessibility violations', async () => {
    const { container } = render(<Button variant="primary">Book a viewing</Button>);
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });

  it('a loading button has no detectable axe-core accessibility violations', async () => {
    const { container } = render(
      <Button loading variant="secondary">
        Save property
      </Button>,
    );
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });
});
