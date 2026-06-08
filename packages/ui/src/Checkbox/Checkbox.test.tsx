// responsive-coverage: opt-out all — Checkbox is a fixed-height fluid-width atom; responsive layout is verified where it composes into page/organism tests
import { createRef, useState } from 'react';
import axe from 'axe-core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Checkbox } from './Checkbox.js';

describe('Checkbox', () => {
  it('renders a real <input type="checkbox">', () => {
    render(<Checkbox label="Email me about new homes" />);
    const input = screen.getByRole('checkbox');
    expect(input.tagName).toBe('INPUT');
    expect(input).toHaveAttribute('type', 'checkbox');
  });

  it('associates the visible label with the input (no placeholder-only)', () => {
    render(<Checkbox label="I agree to the privacy policy" />);
    // getByLabelText resolves only when the label is correctly associated.
    expect(screen.getByLabelText('I agree to the privacy policy')).toBe(
      screen.getByRole('checkbox'),
    );
  });

  it('renders an optional description beneath the label', () => {
    render(<Checkbox label="Marketing emails" description="You can opt out at any time" />);
    expect(screen.getByText('You can opt out at any time')).toBeInTheDocument();
  });

  it('is unchecked by default', () => {
    render(<Checkbox label="Subscribe" />);
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('reflects the controlled checked prop', () => {
    render(<Checkbox label="Subscribe" checked readOnly />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('toggles on click via the label and fires onChange', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Checkbox label="Email me about new homes" onChange={onChange} />);
    const input = screen.getByRole('checkbox');
    expect(input).not.toBeChecked();
    await user.click(screen.getByText('Email me about new homes'));
    expect(input).toBeChecked();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('toggles back and forth when used uncontrolled', async () => {
    const user = userEvent.setup();
    render(<Checkbox label="Toggle me" />);
    const input = screen.getByRole('checkbox');
    await user.click(input);
    expect(input).toBeChecked();
    await user.click(input);
    expect(input).not.toBeChecked();
  });

  it('sets the DOM indeterminate property when indeterminate', () => {
    render(<Checkbox label="Select all" indeterminate />);
    const input = screen.getByRole<HTMLInputElement>('checkbox');
    expect(input.indeterminate).toBe(true);
    // The mixed state is announced to assistive tech, not conveyed by colour alone.
    expect(input).toHaveAttribute('aria-checked', 'mixed');
  });

  it('clears the indeterminate property when toggled off', () => {
    const { rerender } = render(<Checkbox label="Select all" indeterminate />);
    const input = screen.getByRole<HTMLInputElement>('checkbox');
    expect(input.indeterminate).toBe(true);
    rerender(<Checkbox label="Select all" indeterminate={false} />);
    expect(input.indeterminate).toBe(false);
    expect(input).not.toHaveAttribute('aria-checked', 'mixed');
  });

  it('does not toggle when disabled', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Checkbox label="Unavailable" disabled onChange={onChange} />);
    const input = screen.getByRole('checkbox');
    expect(input).toBeDisabled();
    await user.click(input);
    await user.click(screen.getByText('Unavailable'));
    expect(input).not.toBeChecked();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('marks the field invalid and links the error via aria-describedby', () => {
    render(<Checkbox label="I agree to the privacy policy" error="You must accept to continue" />);
    const input = screen.getByRole('checkbox');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const message = screen.getByText('You must accept to continue');
    expect(message).toHaveAttribute('role', 'alert');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(describedBy?.split(' ')).toContain(message.id);
  });

  it('is not invalid when there is no error', () => {
    render(<Checkbox label="Subscribe" />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-invalid', 'false');
  });

  it('links the description via aria-describedby when present', () => {
    render(<Checkbox label="Marketing emails" description="Opt out any time" />);
    const input = screen.getByRole('checkbox');
    const description = screen.getByText('Opt out any time');
    expect(input.getAttribute('aria-describedby')?.split(' ')).toContain(description.id);
  });

  it('honours an explicit id and keeps the label associated', () => {
    render(<Checkbox id="consent" label="I agree" />);
    const input = screen.getByRole('checkbox');
    expect(input).toHaveAttribute('id', 'consent');
    expect(screen.getByLabelText('I agree')).toBe(input);
  });

  it('forwards the name and value for form submission', () => {
    render(<Checkbox label="Subscribe" name="newsletter" value="yes" />);
    const input = screen.getByRole('checkbox');
    expect(input).toHaveAttribute('name', 'newsletter');
    expect(input).toHaveAttribute('value', 'yes');
  });

  it('forwards a ref to the underlying input element', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Checkbox ref={ref} label="Subscribe" />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current?.type).toBe('checkbox');
  });

  it('works when a parent both controls and reads the ref', async () => {
    const ref = createRef<HTMLInputElement>();
    const user = userEvent.setup();
    function Host() {
      const [checked, setChecked] = useState(false);
      return (
        <Checkbox
          ref={ref}
          label="Controlled"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
        />
      );
    }
    render(<Host />);
    await user.click(screen.getByRole('checkbox'));
    expect(ref.current).toBeChecked();
  });

  it('merges a custom className onto the field wrapper', () => {
    const { container } = render(<Checkbox label="Subscribe" className="extra" />);
    expect(container.querySelector('.checkbox-field')).toHaveClass('extra');
  });

  it('forwards arbitrary input attributes', () => {
    render(<Checkbox label="Subscribe" data-analytics="opt-in" />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('data-analytics', 'opt-in');
  });

  // axe's colour-contrast rule needs real layout + canvas, which jsdom does not
  // provide; it is disabled here (and verified instead in the Playwright + axe
  // visual suite). Structural a11y rules (roles, names, aria) run fully in jsdom.
  const axeOptions = { rules: { 'color-contrast': { enabled: false } } } as const;

  it('has no detectable axe-core accessibility violations', async () => {
    const { container } = render(<Checkbox label="Email me about new homes" />);
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });

  it('an errored checkbox has no detectable axe-core accessibility violations', async () => {
    const { container } = render(
      <Checkbox
        label="I agree to the privacy policy"
        description="Required to register"
        error="You must accept to continue"
      />,
    );
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });

  it('a disabled checkbox has no detectable axe-core accessibility violations', async () => {
    const { container } = render(<Checkbox label="Unavailable until consent" disabled />);
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });
});
