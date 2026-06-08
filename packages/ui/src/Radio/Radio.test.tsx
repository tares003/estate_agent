// responsive-coverage: opt-out all — Radio is a fixed-height fluid-width atom; responsive layout is verified where it composes into page/organism tests
import { createRef, useState } from 'react';
import axe from 'axe-core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Radio, RadioGroup } from './Radio.js';

/** A controlled harness so selection actually moves on interaction. */
function ControlledGroup({
  initial = '',
  onChange,
}: {
  initial?: string;
  onChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <RadioGroup
      name="intent"
      label="I'm looking to"
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    >
      <Radio value="buy" label="Buy a property" />
      <Radio value="rent" label="Rent a property" />
      <Radio value="sell" label="Sell or let my property" />
      <Radio value="other" label="Something else (coming soon)" disabled />
    </RadioGroup>
  );
}

describe('RadioGroup', () => {
  it('renders an accessible radiogroup with its label', () => {
    render(<ControlledGroup />);
    expect(screen.getByRole('radiogroup', { name: "I'm looking to" })).toBeInTheDocument();
  });

  it('renders a legend carrying the group label', () => {
    render(<ControlledGroup />);
    const group = screen.getByRole('radiogroup', { name: "I'm looking to" });
    expect(group.tagName).toBe('FIELDSET');
    expect(group.querySelector('legend')).toHaveTextContent("I'm looking to");
  });

  it('renders one real radio input per option, sharing one name', () => {
    render(<ControlledGroup />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(4);
    for (const radio of radios) {
      expect(radio.tagName).toBe('INPUT');
      expect(radio).toHaveAttribute('type', 'radio');
      expect(radio).toHaveAttribute('name', 'intent');
    }
  });

  it('reflects the controlled value as the checked radio', () => {
    render(<ControlledGroup initial="rent" />);
    expect(screen.getByRole('radio', { name: 'Rent a property' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Buy a property' })).not.toBeChecked();
  });

  it('moves selection on click and reports the new value', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ControlledGroup onChange={onChange} />);

    await user.click(screen.getByRole('radio', { name: 'Buy a property' }));
    expect(onChange).toHaveBeenLastCalledWith('buy');
    expect(screen.getByRole('radio', { name: 'Buy a property' })).toBeChecked();

    await user.click(screen.getByRole('radio', { name: 'Sell or let my property' }));
    expect(onChange).toHaveBeenLastCalledWith('sell');
    expect(screen.getByRole('radio', { name: 'Sell or let my property' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Buy a property' })).not.toBeChecked();
  });

  it('clicking the label text toggles the associated input (whole-row hit target)', async () => {
    const user = userEvent.setup();
    render(<ControlledGroup />);
    await user.click(screen.getByText('Rent a property'));
    expect(screen.getByRole('radio', { name: 'Rent a property' })).toBeChecked();
  });

  it('supports native arrow-key navigation between options', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ControlledGroup initial="buy" onChange={onChange} />);

    const first = screen.getByRole('radio', { name: 'Buy a property' });
    first.focus();
    expect(first).toHaveFocus();

    // Native radio groups move selection + focus with the arrow keys.
    await user.keyboard('{ArrowDown}');
    expect(onChange).toHaveBeenLastCalledWith('rent');
    expect(screen.getByRole('radio', { name: 'Rent a property' })).toBeChecked();
  });

  it('does not move selection to a disabled option', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ControlledGroup onChange={onChange} />);
    const disabled = screen.getByRole('radio', { name: 'Something else (coming soon)' });
    expect(disabled).toBeDisabled();
    await user.click(disabled);
    expect(onChange).not.toHaveBeenCalled();
    expect(disabled).not.toBeChecked();
  });

  it('disables every option when the group is disabled', () => {
    render(
      <RadioGroup name="intent" label="I'm looking to" value="" onChange={() => {}} disabled>
        <Radio value="buy" label="Buy a property" />
        <Radio value="rent" label="Rent a property" />
      </RadioGroup>,
    );
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toBeDisabled();
    }
  });

  it('marks the group required on every input and on the fieldset', () => {
    render(
      <RadioGroup name="intent" label="I'm looking to" value="" onChange={() => {}} required>
        <Radio value="buy" label="Buy a property" />
        <Radio value="rent" label="Rent a property" />
      </RadioGroup>,
    );
    const group = screen.getByRole('radiogroup', { name: "I'm looking to" });
    expect(group).toHaveAttribute('aria-required', 'true');
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toBeRequired();
    }
  });

  it('renders an error message wired to the group via aria-describedby with an alert role', () => {
    render(
      <RadioGroup
        name="intent"
        label="I'm looking to"
        value=""
        onChange={() => {}}
        error="Choose an option to continue"
      >
        <Radio value="buy" label="Buy a property" />
        <Radio value="rent" label="Rent a property" />
      </RadioGroup>,
    );
    const group = screen.getByRole('radiogroup', { name: "I'm looking to" });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Choose an option to continue');
    expect(group).toHaveAttribute('aria-invalid', 'true');
    const describedBy = group.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(describedBy?.split(' ')).toContain(alert.id);
  });

  it('renders help text wired to the group via aria-describedby', () => {
    render(
      <RadioGroup
        name="intent"
        label="I'm looking to"
        value=""
        onChange={() => {}}
        helpText="Pick whichever best describes you"
      >
        <Radio value="buy" label="Buy a property" />
        <Radio value="rent" label="Rent a property" />
      </RadioGroup>,
    );
    const group = screen.getByRole('radiogroup', { name: "I'm looking to" });
    const help = screen.getByText('Pick whichever best describes you');
    const describedBy = group.getAttribute('aria-describedby');
    expect(describedBy?.split(' ')).toContain(help.id);
  });

  it('merges a custom className onto the fieldset', () => {
    render(
      <RadioGroup
        name="intent"
        label="I'm looking to"
        value=""
        onChange={() => {}}
        className="extra"
      >
        <Radio value="buy" label="Buy a property" />
      </RadioGroup>,
    );
    expect(screen.getByRole('radiogroup', { name: "I'm looking to" })).toHaveClass(
      'radio-group',
      'extra',
    );
  });

  it('has no detectable axe-core accessibility violations', async () => {
    const { container } = render(<ControlledGroup initial="buy" />);
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });

  it('has no detectable axe-core violations when showing an error', async () => {
    const { container } = render(
      <RadioGroup
        name="intent"
        label="I'm looking to"
        value=""
        onChange={() => {}}
        error="Choose an option to continue"
      >
        <Radio value="buy" label="Buy a property" />
        <Radio value="rent" label="Rent a property" />
      </RadioGroup>,
    );
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });
});

describe('Radio', () => {
  it('associates the label with the input via a wrapping <label>', () => {
    render(<ControlledGroup />);
    // getByRole name resolution proves the label is associated with the input.
    expect(screen.getByRole('radio', { name: 'Buy a property' })).toBeInTheDocument();
  });

  it('renders the decorative dot marked aria-hidden', () => {
    render(<ControlledGroup />);
    const radio = screen.getByRole('radio', { name: 'Buy a property' });
    const row = radio.closest('label');
    expect(row?.querySelector('.dot')).toHaveAttribute('aria-hidden', 'true');
  });

  it('supports a per-option disabled flag independent of the group', () => {
    render(<ControlledGroup />);
    expect(screen.getByRole('radio', { name: 'Something else (coming soon)' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Buy a property' })).not.toBeDisabled();
  });

  it('renders an optional per-option description', () => {
    render(
      <RadioGroup name="intent" label="I'm looking to" value="" onChange={() => {}}>
        <Radio value="buy" label="Buy a property" description="Browse homes for sale" />
      </RadioGroup>,
    );
    expect(screen.getByText('Browse homes for sale')).toBeInTheDocument();
  });

  it('forwards a ref to the underlying input element', () => {
    const ref = createRef<HTMLInputElement>();
    render(
      <RadioGroup name="intent" label="I'm looking to" value="" onChange={() => {}}>
        <Radio ref={ref} value="buy" label="Buy a property" />
      </RadioGroup>,
    );
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current?.type).toBe('radio');
  });

  it('forwards arbitrary input attributes', () => {
    render(
      <RadioGroup name="intent" label="I'm looking to" value="" onChange={() => {}}>
        <Radio value="buy" label="Buy a property" data-testid="buy-radio" />
      </RadioGroup>,
    );
    expect(screen.getByTestId('buy-radio')).toHaveAttribute('type', 'radio');
  });

  it('throws a helpful error when rendered outside a RadioGroup', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Radio value="buy" label="Buy a property" />)).toThrow(
      /must be rendered inside a <RadioGroup>/,
    );
    spy.mockRestore();
  });
});

// axe's colour-contrast rule needs real layout + canvas, which jsdom does not
// provide; it is disabled here (and verified instead in the Playwright + axe
// visual suite where the real browser renders the token colours). Structural
// a11y rules (roles, names, aria) run fully in jsdom.
const axeOptions = { rules: { 'color-contrast': { enabled: false } } } as const;
