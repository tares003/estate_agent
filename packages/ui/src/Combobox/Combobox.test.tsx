// responsive-coverage: opt-out all — Combobox is a fluid/viewport-invariant primitive; responsive layout is verified where it composes into page tests
import { useState, type ReactElement } from 'react';
import axe from 'axe-core';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Combobox, type ComboboxOption } from './Combobox.js';

const OPTIONS: ComboboxOption[] = [
  { value: 'manchester', label: 'Manchester' },
  { value: 'leeds', label: 'Leeds' },
  { value: 'liverpool', label: 'Liverpool' },
  { value: 'london', label: 'London' },
];

// axe's colour-contrast rule needs real layout + canvas, which jsdom does not
// provide; it is disabled here (and verified instead in the Playwright + axe
// visual suite). Structural a11y rules (roles, names, aria) run fully in jsdom.
const axeOptions = { rules: { 'color-contrast': { enabled: false } } } as const;

/** Controlled harness: mirrors how the Combobox is used in real surfaces. */
function Harness({
  initial = '',
  onChange = vi.fn(),
  ...rest
}: {
  initial?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  id?: string;
}): ReactElement {
  const [value, setValue] = useState(initial);
  return (
    <Combobox
      label="Town or city"
      options={OPTIONS}
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange(v);
      }}
      {...rest}
    />
  );
}

describe('Combobox', () => {
  it('renders a labelled combobox input collapsed by default', () => {
    render(<Harness />);
    const input = screen.getByRole('combobox', { name: 'Town or city' });
    expect(input.tagName).toBe('INPUT');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('associates the visible label with the input (never placeholder-only)', () => {
    render(<Harness />);
    const input = screen.getByRole('combobox', { name: 'Town or city' });
    expect(input).toHaveAccessibleName('Town or city');
  });

  it('wires aria-controls from the input to the listbox when open', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('combobox');
    await user.click(input);
    const listbox = screen.getByRole('listbox');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('aria-controls', listbox.id);
  });

  it('renders every option as role="option" when open', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('combobox'));
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(OPTIONS.length);
    expect(options.map((o) => o.textContent)).toEqual([
      'Manchester',
      'Leeds',
      'Liverpool',
      'London',
    ]);
  });

  it('filters the options as the user types', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('combobox');
    await user.click(input);
    await user.type(input, 'l');
    const labels = screen.getAllByRole('option').map((o) => o.textContent);
    // case-insensitive substring match: Leeds, Liverpool, London
    expect(labels).toEqual(['Leeds', 'Liverpool', 'London']);
  });

  it('shows an empty-state message when nothing matches', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('combobox');
    await user.click(input);
    await user.type(input, 'zzz');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText(/no matches/i)).toBeInTheDocument();
  });

  it('ArrowDown opens the popup and highlights the first option via aria-activedescendant', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('combobox');
    input.focus();
    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    const first = screen.getAllByRole('option')[0] as HTMLElement;
    expect(input).toHaveAttribute('aria-activedescendant', first.id);
    expect(first).toHaveAttribute('aria-selected', 'true');
  });

  it('ArrowDown / ArrowUp move the highlight and wrap', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('combobox');
    input.focus();
    await user.keyboard('{ArrowDown}'); // open + first
    await user.keyboard('{ArrowDown}'); // second
    const options = screen.getAllByRole('option');
    expect(input).toHaveAttribute('aria-activedescendant', options[1]?.id);
    // ArrowUp back to first
    await user.keyboard('{ArrowUp}');
    expect(input).toHaveAttribute('aria-activedescendant', options[0]?.id);
    // ArrowUp from first wraps to last
    await user.keyboard('{ArrowUp}');
    expect(input).toHaveAttribute('aria-activedescendant', options[options.length - 1]?.id);
  });

  it('Home and End jump the highlight to the first and last options', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('combobox');
    input.focus();
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{End}');
    const options = screen.getAllByRole('option');
    expect(input).toHaveAttribute('aria-activedescendant', options[options.length - 1]?.id);
    await user.keyboard('{Home}');
    expect(input).toHaveAttribute('aria-activedescendant', options[0]?.id);
  });

  it('Enter selects the highlighted option, calls onChange, and closes', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);
    const input = screen.getByRole('combobox') as HTMLInputElement;
    input.focus();
    await user.keyboard('{ArrowDown}'); // open + highlight Manchester
    await user.keyboard('{ArrowDown}'); // highlight Leeds
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('leeds');
    expect(input.value).toBe('Leeds');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('clicking an option selects it and closes', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);
    const input = screen.getByRole('combobox') as HTMLInputElement;
    await user.click(input);
    await user.click(screen.getByRole('option', { name: 'Liverpool' }));
    expect(onChange).toHaveBeenCalledWith('liverpool');
    expect(input.value).toBe('Liverpool');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('Escape closes the popup without selecting', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);
    const input = screen.getByRole('combobox');
    await user.click(input);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('an outside click closes the popup', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Harness />
        <button type="button">Outside</button>
      </div>,
    );
    await user.click(screen.getByRole('combobox'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('reflects the controlled value as the input text', () => {
    render(<Harness initial="london" />);
    expect(screen.getByRole('combobox')).toHaveValue('London');
  });

  it('renders a hint linked via aria-describedby', () => {
    render(<Harness hint="Start typing to filter" />);
    const input = screen.getByRole('combobox');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)).toHaveTextContent(
      'Start typing to filter',
    );
  });

  it('surfaces an error via aria-invalid + role="alert" linked by aria-describedby', () => {
    render(<Harness error="Select a town" />);
    const input = screen.getByRole('combobox');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Select a town');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy?.split(' ')).toContain(alert.id);
  });

  it('honours a supplied id on the input', () => {
    render(<Harness id="town-combobox" />);
    expect(screen.getByRole('combobox')).toHaveAttribute('id', 'town-combobox');
  });

  it('renders the placeholder on the input', () => {
    render(<Harness placeholder="e.g. Manchester" />);
    expect(screen.getByRole('combobox')).toHaveAttribute('placeholder', 'e.g. Manchester');
  });

  it('marks the highlighted option with role/aria-selected, others unselected', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('combobox');
    input.focus();
    await user.keyboard('{ArrowDown}');
    const options = screen.getAllByRole('option');
    const selected = options.filter((o) => o.getAttribute('aria-selected') === 'true');
    expect(selected).toHaveLength(1);
    expect(selected[0]).toBe(options[0]);
  });

  it('listbox has an accessible name matching the field label', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('combobox'));
    expect(screen.getByRole('listbox')).toHaveAccessibleName('Town or city');
  });

  it('has no detectable axe-core accessibility violations when collapsed', async () => {
    const { container } = render(<Harness hint="Start typing to filter" />);
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });

  it('has no detectable axe-core accessibility violations when expanded', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    await user.click(screen.getByRole('combobox'));
    await user.keyboard('{ArrowDown}');
    expect(within(container).getByRole('listbox')).toBeInTheDocument();
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });

  it('has no detectable axe-core accessibility violations in the error state', async () => {
    const { container } = render(<Harness error="Select a town" />);
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });
});
