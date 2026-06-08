// responsive-coverage: opt-out all — Select is a fixed-height fluid-width atom; responsive layout is verified where it composes into page/organism tests
import { createRef } from 'react';
import axe from 'axe-core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Select } from './Select.js';
import type { SelectOption } from './Select.js';

// axe's colour-contrast rule needs real layout + canvas, which jsdom does not
// provide; it is disabled here (and verified instead in the Playwright + axe
// visual suite where the real browser renders the token colours). Structural
// a11y rules (roles, names, aria) run fully in jsdom.
const axeOptions = { rules: { 'color-contrast': { enabled: false } } } as const;

const PROPERTY_TYPES: SelectOption[] = [
  { value: 'detached', label: 'Detached' },
  { value: 'semi', label: 'Semi-detached' },
  { value: 'terraced', label: 'Terraced' },
  { value: 'flat', label: 'Flat / apartment', disabled: true },
];

describe('Select', () => {
  it('associates the visible label with the select via htmlFor/id', () => {
    render(<Select label="Property type" id="property-type" options={PROPERTY_TYPES} />);
    const select = screen.getByLabelText('Property type');
    expect(select).toBeInTheDocument();
    expect(select.id).toBe('property-type');
  });

  it('renders a real <select> element', () => {
    render(<Select label="Property type" options={PROPERTY_TYPES} />);
    const select = screen.getByLabelText('Property type');
    expect(select.tagName).toBe('SELECT');
  });

  it('generates a stable id and wires the label to it when none is passed', () => {
    render(<Select label="Property type" options={PROPERTY_TYPES} />);
    const select = screen.getByLabelText('Property type') as HTMLSelectElement;
    expect(select.id).toBeTruthy();
    const label = screen.getByText('Property type');
    expect(label).toHaveAttribute('for', select.id);
  });

  it('gives each auto-generated field a distinct id', () => {
    render(
      <>
        <Select label="First" options={PROPERTY_TYPES} />
        <Select label="Second" options={PROPERTY_TYPES} />
      </>,
    );
    const first = screen.getByLabelText('First') as HTMLSelectElement;
    const second = screen.getByLabelText('Second') as HTMLSelectElement;
    expect(first.id).not.toBe(second.id);
  });

  it('renders one <option> per entry in the options array', () => {
    render(<Select label="Property type" options={PROPERTY_TYPES} />);
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(PROPERTY_TYPES.length);
    expect(screen.getByRole('option', { name: 'Detached' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Semi-detached' })).toBeInTheDocument();
  });

  it('marks an option disabled when its entry sets disabled', () => {
    render(<Select label="Property type" options={PROPERTY_TYPES} />);
    expect(screen.getByRole('option', { name: 'Flat / apartment' })).toBeDisabled();
    expect(screen.getByRole('option', { name: 'Detached' })).not.toBeDisabled();
  });

  it('renders option children when no options array is supplied', () => {
    render(
      <Select label="Branch">
        <option value="north">North office</option>
        <option value="south">South office</option>
      </Select>,
    );
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);
    expect(screen.getByRole('option', { name: 'North office' })).toBeInTheDocument();
  });

  it('renders a disabled hidden placeholder as the first option when placeholder is set', () => {
    render(<Select label="Property type" placeholder="Select a type" options={PROPERTY_TYPES} />);
    const select = screen.getByLabelText('Property type') as HTMLSelectElement;
    // the placeholder is rendered first, before any real option
    const placeholder = select.options[0];
    expect(placeholder).toBeDefined();
    expect(placeholder?.textContent).toBe('Select a type');
    expect(placeholder?.disabled).toBe(true);
    expect(placeholder?.hidden).toBe(true);
    expect(placeholder?.value).toBe('');
    // the placeholder adds exactly one option beyond the real list
    expect(select.options).toHaveLength(PROPERTY_TYPES.length + 1);
  });

  it('does not render a placeholder option when no placeholder is set', () => {
    render(<Select label="Property type" options={PROPERTY_TYPES} />);
    const select = screen.getByLabelText('Property type') as HTMLSelectElement;
    expect(select.options).toHaveLength(PROPERTY_TYPES.length);
  });

  it('reflects a controlled value', () => {
    render(
      <Select
        label="Property type"
        options={PROPERTY_TYPES}
        value="terraced"
        onChange={() => undefined}
      />,
    );
    expect(screen.getByLabelText('Property type')).toHaveValue('terraced');
  });

  it('honours defaultValue for an uncontrolled select', () => {
    render(<Select label="Property type" options={PROPERTY_TYPES} defaultValue="semi" />);
    expect(screen.getByLabelText('Property type')).toHaveValue('semi');
  });

  it('changes the selected value and fires onChange when the user picks an option', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Select label="Property type" options={PROPERTY_TYPES} onChange={onChange} />);
    const select = screen.getByLabelText('Property type') as HTMLSelectElement;
    await user.selectOptions(select, 'terraced');
    expect(onChange).toHaveBeenCalled();
    expect(select).toHaveValue('terraced');
  });

  it('renders hint text and links it via aria-describedby', () => {
    render(
      <Select label="Property type" options={PROPERTY_TYPES} hint="Pick the closest match." />,
    );
    const select = screen.getByLabelText('Property type');
    const hint = screen.getByText('Pick the closest match.');
    expect(hint).toBeInTheDocument();
    expect(select.getAttribute('aria-describedby')).toContain(hint.id);
  });

  it('shows an error wired via aria-describedby and sets aria-invalid', () => {
    render(
      <Select label="Property type" options={PROPERTY_TYPES} error="Choose a property type." />,
    );
    const select = screen.getByLabelText('Property type');
    expect(select).toHaveAttribute('aria-invalid', 'true');
    const message = screen.getByText('Choose a property type.');
    expect(select.getAttribute('aria-describedby')).toContain(message.id);
  });

  it('announces the error through a live region (role="alert")', () => {
    render(<Select label="Property type" options={PROPERTY_TYPES} error="Something went wrong." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong.');
  });

  it('is not invalid and exposes no error message when there is no error', () => {
    render(<Select label="Property type" options={PROPERTY_TYPES} />);
    const select = screen.getByLabelText('Property type');
    expect(select).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('describes the select by both the hint and the error when both are present', () => {
    render(
      <Select
        label="Property type"
        options={PROPERTY_TYPES}
        hint="Pick the closest match."
        error="Required."
      />,
    );
    const select = screen.getByLabelText('Property type');
    const hint = screen.getByText('Pick the closest match.');
    const error = screen.getByText('Required.');
    const describedBy = select.getAttribute('aria-describedby') ?? '';
    expect(describedBy).toContain(hint.id);
    expect(describedBy).toContain(error.id);
  });

  it('marks the control in the error state with a class on the select', () => {
    render(<Select label="Property type" options={PROPERTY_TYPES} error="Required." />);
    expect(screen.getByLabelText('Property type')).toHaveClass('is-error');
  });

  it('renders a required marker conveyed by text, not colour alone', () => {
    render(<Select label="Property type" options={PROPERTY_TYPES} required />);
    const select = screen.getByLabelText(/Property type/);
    expect(select).toBeRequired();
    expect(screen.getByText(/\(required\)/i)).toBeInTheDocument();
  });

  it('does not render the required marker when not required', () => {
    render(<Select label="Property type" options={PROPERTY_TYPES} />);
    expect(screen.queryByText(/\(required\)/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Property type')).not.toBeRequired();
  });

  it('disables the select when disabled', () => {
    render(<Select label="Property type" options={PROPERTY_TYPES} disabled />);
    expect(screen.getByLabelText('Property type')).toBeDisabled();
  });

  it('forwards a ref to the underlying select element', () => {
    const ref = createRef<HTMLSelectElement>();
    render(<Select label="Property type" options={PROPERTY_TYPES} ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLSelectElement);
  });

  it('forwards arbitrary attributes and merges a custom className on the select', () => {
    render(
      <Select
        label="Property type"
        options={PROPERTY_TYPES}
        className="extra"
        name="property_type"
        data-analytics="type-field"
      />,
    );
    const select = screen.getByLabelText('Property type');
    expect(select).toHaveClass('control', 'extra');
    expect(select).toHaveAttribute('name', 'property_type');
    expect(select).toHaveAttribute('data-analytics', 'type-field');
  });

  it('has no detectable axe-core accessibility violations (default)', async () => {
    const { container } = render(
      <Select label="Property type" options={PROPERTY_TYPES} hint="Pick the closest match." />,
    );
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });

  it('has no detectable axe-core accessibility violations (error state)', async () => {
    const { container } = render(
      <Select
        label="Property type"
        options={PROPERTY_TYPES}
        required
        error="Choose a property type."
      />,
    );
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });

  it('has no detectable axe-core accessibility violations (with placeholder)', async () => {
    const { container } = render(
      <Select label="Property type" options={PROPERTY_TYPES} placeholder="Select a type" />,
    );
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });
});
