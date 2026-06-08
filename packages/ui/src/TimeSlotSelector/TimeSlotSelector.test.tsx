// responsive-coverage: opt-out all — TimeSlotSelector is a fluid/viewport-invariant primitive; responsive layout is verified where it composes into page tests
import { useState } from 'react';
import axe from 'axe-core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TimeSlotSelector, type TimeSlot } from './TimeSlotSelector.js';

const SLOTS: TimeSlot[] = [
  { value: '09:00', label: '9:00 AM' },
  { value: '10:00', label: '10:00 AM' },
  { value: '11:00', label: '11:00 AM' },
  { value: '12:00', label: '12:00 PM', disabled: true },
];

/** A controlled harness so selection actually moves on interaction. */
function ControlledSelector({
  initial = '',
  onChange,
  slots = SLOTS,
}: {
  initial?: string;
  onChange?: (value: string) => void;
  slots?: TimeSlot[];
}) {
  const [value, setValue] = useState(initial);
  return (
    <TimeSlotSelector
      legend="Choose a viewing time"
      slots={slots}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

// axe's colour-contrast rule needs real layout + canvas, which jsdom does not
// provide; it is disabled here (verified instead in the Playwright + axe visual
// suite). Structural a11y rules (roles, names, aria) run fully in jsdom.
const axeOptions = { rules: { 'color-contrast': { enabled: false } } } as const;

describe('TimeSlotSelector', () => {
  it('renders an accessible radiogroup carrying the legend as its name', () => {
    render(<ControlledSelector />);
    expect(screen.getByRole('radiogroup', { name: 'Choose a viewing time' })).toBeInTheDocument();
  });

  it('renders a fieldset with a legend carrying the group label', () => {
    render(<ControlledSelector />);
    const group = screen.getByRole('radiogroup', { name: 'Choose a viewing time' });
    expect(group.tagName).toBe('FIELDSET');
    expect(group.querySelector('legend')).toHaveTextContent('Choose a viewing time');
  });

  it('renders one REAL radio input per slot, sharing one name', () => {
    render(<ControlledSelector />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(4);
    const firstName = radios[0]?.getAttribute('name');
    expect(firstName).toBeTruthy();
    for (const radio of radios) {
      expect(radio.tagName).toBe('INPUT');
      expect(radio).toHaveAttribute('type', 'radio');
      expect(radio).toHaveAttribute('name', firstName);
    }
  });

  it('uses the supplied name for every input when given', () => {
    render(
      <TimeSlotSelector
        legend="Choose a viewing time"
        name="viewing-slot"
        slots={SLOTS}
        value=""
        onChange={() => {}}
      />,
    );
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toHaveAttribute('name', 'viewing-slot');
    }
  });

  it('associates each slot label with its input (label association, not placeholder)', () => {
    render(<ControlledSelector />);
    // getByRole name resolution proves the label is associated with the input.
    expect(screen.getByRole('radio', { name: '9:00 AM' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '10:00 AM' })).toBeInTheDocument();
  });

  it('reflects the controlled value as the checked radio', () => {
    render(<ControlledSelector initial="10:00" />);
    expect(screen.getByRole('radio', { name: '10:00 AM' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '9:00 AM' })).not.toBeChecked();
  });

  it('moves selection on click and reports the new value', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ControlledSelector onChange={onChange} />);

    await user.click(screen.getByRole('radio', { name: '9:00 AM' }));
    expect(onChange).toHaveBeenLastCalledWith('09:00');
    expect(screen.getByRole('radio', { name: '9:00 AM' })).toBeChecked();

    await user.click(screen.getByRole('radio', { name: '11:00 AM' }));
    expect(onChange).toHaveBeenLastCalledWith('11:00');
    expect(screen.getByRole('radio', { name: '11:00 AM' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '9:00 AM' })).not.toBeChecked();
  });

  it('lets the whole chip act as the hit target by clicking the label text', async () => {
    const user = userEvent.setup();
    render(<ControlledSelector />);
    await user.click(screen.getByText('10:00 AM'));
    expect(screen.getByRole('radio', { name: '10:00 AM' })).toBeChecked();
  });

  it('supports native arrow-key navigation between slots', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ControlledSelector initial="09:00" onChange={onChange} />);

    const first = screen.getByRole('radio', { name: '9:00 AM' });
    first.focus();
    expect(first).toHaveFocus();

    // Native radio groups move selection + focus with the arrow keys.
    await user.keyboard('{ArrowDown}');
    expect(onChange).toHaveBeenLastCalledWith('10:00');
    expect(screen.getByRole('radio', { name: '10:00 AM' })).toBeChecked();
  });

  it('does not select a disabled slot', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ControlledSelector onChange={onChange} />);
    const disabled = screen.getByRole('radio', { name: '12:00 PM' });
    expect(disabled).toBeDisabled();
    await user.click(disabled);
    expect(onChange).not.toHaveBeenCalled();
    expect(disabled).not.toBeChecked();
  });

  it('only disables the slots flagged disabled, not the rest', () => {
    render(<ControlledSelector />);
    expect(screen.getByRole('radio', { name: '12:00 PM' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: '9:00 AM' })).not.toBeDisabled();
    expect(screen.getByRole('radio', { name: '10:00 AM' })).not.toBeDisabled();
  });

  it('renders an empty group without throwing when there are no slots', () => {
    render(
      <TimeSlotSelector legend="No times available" slots={[]} value="" onChange={() => {}} />,
    );
    expect(screen.getByRole('radiogroup', { name: 'No times available' })).toBeInTheDocument();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });

  it('merges a custom className onto the fieldset', () => {
    render(
      <TimeSlotSelector
        legend="Choose a viewing time"
        slots={SLOTS}
        value=""
        onChange={() => {}}
        className="extra"
      />,
    );
    expect(screen.getByRole('radiogroup', { name: 'Choose a viewing time' })).toHaveClass(
      'time-slot-selector',
      'extra',
    );
  });

  it('marks the visible check indicator decorative (aria-hidden)', () => {
    render(<ControlledSelector initial="09:00" />);
    const radio = screen.getByRole('radio', { name: '9:00 AM' });
    const chip = radio.closest('label');
    expect(chip?.querySelector('.time-slot-mark')).toHaveAttribute('aria-hidden', 'true');
  });

  it('has no detectable axe-core accessibility violations', async () => {
    const { container } = render(<ControlledSelector initial="09:00" />);
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });

  it('has no detectable axe-core violations with a disabled slot and no selection', async () => {
    const { container } = render(<ControlledSelector />);
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });
});
