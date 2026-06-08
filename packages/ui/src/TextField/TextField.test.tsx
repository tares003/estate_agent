// responsive-coverage: opt-out all — TextField is a fixed-height fluid-width atom; responsive layout is verified where it composes into page/organism tests
import { createRef } from 'react';
import axe from 'axe-core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EmailField, NumberField, PhoneField, TextField } from './TextField.js';

// axe's colour-contrast rule needs real layout + canvas, which jsdom does not
// provide; it is disabled here (and verified instead in the Playwright + axe
// visual suite where the real browser renders the token colours). Structural
// a11y rules (roles, names, aria) run fully in jsdom.
const axeOptions = { rules: { 'color-contrast': { enabled: false } } } as const;

describe('TextField', () => {
  it('associates the visible label with the input via htmlFor/id', () => {
    render(<TextField label="Full name" id="full-name" />);
    const input = screen.getByLabelText('Full name');
    expect(input).toBeInTheDocument();
    expect(input.id).toBe('full-name');
  });

  it('renders a real <input> element of type text by default', () => {
    render(<TextField label="Full name" />);
    const input = screen.getByLabelText('Full name');
    expect(input.tagName).toBe('INPUT');
    expect(input).toHaveAttribute('type', 'text');
  });

  it('generates a stable id and wires the label to it when none is passed', () => {
    render(<TextField label="Full name" />);
    const input = screen.getByLabelText('Full name') as HTMLInputElement;
    expect(input.id).toBeTruthy();
    const label = screen.getByText('Full name');
    expect(label).toHaveAttribute('for', input.id);
  });

  it('gives each auto-generated field a distinct id', () => {
    render(
      <>
        <TextField label="First" />
        <TextField label="Second" />
      </>,
    );
    const first = screen.getByLabelText('First') as HTMLInputElement;
    const second = screen.getByLabelText('Second') as HTMLInputElement;
    expect(first.id).not.toBe(second.id);
  });

  it('renders hint text and links it via aria-describedby', () => {
    render(<TextField label="Email address" hint="We only use this to reply." />);
    const input = screen.getByLabelText('Email address');
    const hint = screen.getByText('We only use this to reply.');
    expect(hint).toBeInTheDocument();
    expect(input.getAttribute('aria-describedby')).toContain(hint.id);
  });

  it('shows an error message wired via aria-describedby and sets aria-invalid', () => {
    render(
      <TextField
        label="Email address"
        error="Enter a complete email address, like name@example.co.uk."
      />,
    );
    const input = screen.getByLabelText('Email address');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const message = screen.getByText('Enter a complete email address, like name@example.co.uk.');
    expect(input.getAttribute('aria-describedby')).toContain(message.id);
  });

  it('announces the error through a live region (role="alert")', () => {
    render(<TextField label="Email address" error="Something went wrong." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong.');
  });

  it('is not invalid and exposes no error message when there is no error', () => {
    render(<TextField label="Email address" />);
    const input = screen.getByLabelText('Email address');
    expect(input).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('describes the input by both the hint and the error when both are present', () => {
    render(<TextField label="Email" hint="Work address preferred." error="Required." />);
    const input = screen.getByLabelText('Email');
    const hint = screen.getByText('Work address preferred.');
    const error = screen.getByText('Required.');
    const describedBy = input.getAttribute('aria-describedby') ?? '';
    expect(describedBy).toContain(hint.id);
    expect(describedBy).toContain(error.id);
  });

  it('renders a required marker conveyed by text, not colour alone', () => {
    render(<TextField label="Full name" required />);
    const input = screen.getByLabelText(/Full name/);
    expect(input).toBeRequired();
    // status is conveyed in the accessible label text, not by colour alone (G9)
    expect(screen.getByText(/\(required\)/i)).toBeInTheDocument();
  });

  it('does not render the required marker when not required', () => {
    render(<TextField label="Full name" />);
    expect(screen.queryByText(/\(required\)/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Full name')).not.toBeRequired();
  });

  it('disables the input when disabled', () => {
    render(<TextField label="Reference number" disabled value="EA-2026-00417" readOnly />);
    expect(screen.getByLabelText('Reference number')).toBeDisabled();
  });

  it('reflects a controlled value and fires onChange on input', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TextField label="Full name" value="" onChange={onChange} />);
    const input = screen.getByLabelText('Full name');
    await user.type(input, 'Jordan');
    expect(onChange).toHaveBeenCalled();
  });

  it('renders a leading adornment marked decorative', () => {
    render(<TextField label="Phone" leadingAdornment={<span data-testid="pre">+44</span>} />);
    const pre = screen.getByTestId('pre');
    expect(pre).toBeInTheDocument();
    expect(pre.parentElement).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders a trailing adornment marked decorative', () => {
    render(<TextField label="Search" trailingAdornment={<svg data-testid="icon" />} />);
    const icon = screen.getByTestId('icon');
    expect(icon).toBeInTheDocument();
    expect(icon.parentElement).toHaveAttribute('aria-hidden', 'true');
  });

  it('forwards a ref to the underlying input element', () => {
    const ref = createRef<HTMLInputElement>();
    render(<TextField label="Full name" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('forwards arbitrary input attributes and merges a custom className on the input', () => {
    render(
      <TextField
        label="Full name"
        className="extra"
        autoComplete="name"
        data-analytics="name-field"
      />,
    );
    const input = screen.getByLabelText('Full name');
    expect(input).toHaveClass('control', 'extra');
    expect(input).toHaveAttribute('autocomplete', 'name');
    expect(input).toHaveAttribute('data-analytics', 'name-field');
  });

  it('marks the control in the error state with a class on the input', () => {
    render(<TextField label="Email" error="Required." />);
    expect(screen.getByLabelText('Email')).toHaveClass('is-error');
  });

  it('has no detectable axe-core accessibility violations (default)', async () => {
    const { container } = render(<TextField label="Full name" hint="As on your passport." />);
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });

  it('has no detectable axe-core accessibility violations (error state)', async () => {
    const { container } = render(
      <TextField label="Email address" required error="Enter a complete email address." />,
    );
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });
});

describe('EmailField', () => {
  it('renders type=email with inputMode=email', () => {
    render(<EmailField label="Email address" />);
    const input = screen.getByLabelText('Email address');
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveAttribute('inputmode', 'email');
  });

  it('inherits TextField behaviour (label association, error)', () => {
    render(<EmailField label="Email address" error="Required." />);
    const input = screen.getByLabelText('Email address');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Required.');
  });

  it('has no detectable axe-core accessibility violations', async () => {
    const { container } = render(<EmailField label="Email address" />);
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });
});

describe('PhoneField', () => {
  it('renders type=tel with inputMode=tel', () => {
    render(<PhoneField label="Phone number" />);
    const input = screen.getByLabelText('Phone number');
    expect(input).toHaveAttribute('type', 'tel');
    expect(input).toHaveAttribute('inputmode', 'tel');
  });

  it('has no detectable axe-core accessibility violations', async () => {
    const { container } = render(<PhoneField label="Phone number" />);
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });
});

describe('NumberField', () => {
  it('renders type=number with inputMode=numeric', () => {
    render(<NumberField label="Minimum bedrooms" />);
    const input = screen.getByLabelText('Minimum bedrooms');
    expect(input).toHaveAttribute('type', 'number');
    expect(input).toHaveAttribute('inputmode', 'numeric');
  });

  it('has no detectable axe-core accessibility violations', async () => {
    const { container } = render(<NumberField label="Minimum bedrooms" />);
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });
});
