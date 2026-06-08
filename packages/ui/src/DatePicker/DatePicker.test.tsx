// responsive-coverage: opt-out all — DatePicker is a fluid/viewport-invariant primitive; responsive layout is verified where it composes into page tests
import { useState, type ReactElement } from 'react';
import axe from 'axe-core';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DatePicker } from './DatePicker.js';

// axe's colour-contrast rule needs real layout + canvas, which jsdom does not
// provide; it is disabled here (and verified instead in the Playwright + axe
// visual suite). Structural a11y rules (roles, names, aria) run fully in jsdom.
const axeOptions = { rules: { 'color-contrast': { enabled: false } } } as const;

/** Open the calendar popover and return its dialog element. */
async function openCalendar(user: ReturnType<typeof userEvent.setup>): Promise<HTMLElement> {
  await user.click(screen.getByRole('button', { name: /choose date|change date/i }));
  return screen.getByRole('dialog');
}

describe('DatePicker', () => {
  it('renders a labelled date field', () => {
    render(<DatePicker label="Move-in date" value={null} onChange={vi.fn()} />);
    expect(screen.getByText('Move-in date')).toBeInTheDocument();
    // the trigger that opens the calendar is reachable as a button
    expect(screen.getByRole('button', { name: /choose date/i })).toBeInTheDocument();
  });

  it('associates the label with the field via htmlFor', () => {
    render(<DatePicker id="movein" label="Move-in date" value={null} onChange={vi.fn()} />);
    const label = screen.getByText('Move-in date');
    expect(label.tagName).toBe('LABEL');
    expect(label).toHaveAttribute('for', 'movein');
    // the element the label points at exists
    expect(document.getElementById('movein')).toBeInTheDocument();
  });

  it('shows the selected value in the field', () => {
    render(<DatePicker label="Move-in date" value="2026-06-15" onChange={vi.fn()} />);
    // the human-readable date is shown to the user
    expect(screen.getByText(/15 June 2026/)).toBeInTheDocument();
  });

  it('keeps the calendar closed until the trigger is activated', () => {
    render(<DatePicker label="Move-in date" value={null} onChange={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });

  it('opens the calendar as a labelled dialog containing a grid', async () => {
    const user = userEvent.setup();
    render(<DatePicker label="Move-in date" value="2026-06-15" onChange={vi.fn()} />);
    const dialog = await openCalendar(user);
    expect(dialog).toHaveAccessibleName();
    expect(within(dialog).getByRole('grid')).toBeInTheDocument();
    // rows + gridcells exist
    expect(within(dialog).getAllByRole('row').length).toBeGreaterThan(0);
    expect(within(dialog).getAllByRole('gridcell').length).toBeGreaterThan(0);
  });

  it('shows the month and year label and prev/next month controls', async () => {
    const user = userEvent.setup();
    render(<DatePicker label="Move-in date" value="2026-06-15" onChange={vi.fn()} />);
    const dialog = await openCalendar(user);
    expect(within(dialog).getByText(/June 2026/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /previous month/i })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /next month/i })).toBeInTheDocument();
  });

  it('navigates to the next and previous month', async () => {
    const user = userEvent.setup();
    render(<DatePicker label="Move-in date" value="2026-06-15" onChange={vi.fn()} />);
    const dialog = await openCalendar(user);

    await user.click(within(dialog).getByRole('button', { name: /next month/i }));
    expect(within(dialog).getByText(/July 2026/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /previous month/i }));
    await user.click(within(dialog).getByRole('button', { name: /previous month/i }));
    expect(within(dialog).getByText(/May 2026/)).toBeInTheDocument();
  });

  it('rolls the year over when navigating across December', async () => {
    const user = userEvent.setup();
    render(<DatePicker label="Move-in date" value="2026-12-15" onChange={vi.fn()} />);
    const dialog = await openCalendar(user);
    await user.click(within(dialog).getByRole('button', { name: /next month/i }));
    expect(within(dialog).getByText(/January 2027/)).toBeInTheDocument();
  });

  it('marks the selected day with aria-selected (on its gridcell)', async () => {
    const user = userEvent.setup();
    render(<DatePicker label="Move-in date" value="2026-06-15" onChange={vi.fn()} />);
    const dialog = await openCalendar(user);
    // aria-selected lives on the gridcell that wraps the day button (APG shape)
    const selectedCell = within(dialog).getByRole('gridcell', { selected: true });
    expect(within(selectedCell).getByRole('button', { name: /15 June 2026/ })).toBeInTheDocument();
    // only one day is selected
    expect(within(dialog).getAllByRole('gridcell', { selected: true })).toHaveLength(1);
  });

  it('marks today with aria-current="date" on its gridcell', async () => {
    const today = new Date();
    const day = today.getDate();
    const monthName = today.toLocaleString('en-GB', { month: 'long' });
    const year = today.getFullYear();
    const isoMonth = String(today.getMonth() + 1).padStart(2, '0');
    const value = `${year}-${isoMonth}-${String(day).padStart(2, '0')}`;
    const user = userEvent.setup();
    render(<DatePicker label="Move-in date" value={value} onChange={vi.fn()} />);
    const dialog = await openCalendar(user);
    const todayBtn = within(dialog).getByRole('button', {
      name: `${day} ${monthName} ${year}`,
    });
    // aria-current is on the wrapping gridcell
    expect(todayBtn.closest('[role="gridcell"]')).toHaveAttribute('aria-current', 'date');
  });

  it('selects a day by click and fires onChange with the ISO string', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DatePicker label="Move-in date" value="2026-06-15" onChange={onChange} />);
    const dialog = await openCalendar(user);
    await user.click(within(dialog).getByRole('button', { name: /20 June 2026/ }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('2026-06-20');
  });

  it('closes the calendar after a day is selected', async () => {
    const user = userEvent.setup();

    function Harness(): ReactElement {
      const [value, setValue] = useState<string | null>('2026-06-15');
      return <DatePicker label="Move-in date" value={value} onChange={setValue} />;
    }

    render(<Harness />);
    const dialog = await openCalendar(user);
    await user.click(within(dialog).getByRole('button', { name: /20 June 2026/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // the field now reflects the new value
    expect(screen.getByText(/20 June 2026/)).toBeInTheDocument();
  });

  it('moves focus into the grid on open (onto the selected day)', async () => {
    const user = userEvent.setup();
    render(<DatePicker label="Move-in date" value="2026-06-15" onChange={vi.fn()} />);
    const dialog = await openCalendar(user);
    const selected = within(dialog).getByRole('button', { name: /15 June 2026/ });
    expect(selected).toHaveFocus();
  });

  it('moves focus by day with ArrowRight / ArrowLeft', async () => {
    const user = userEvent.setup();
    render(<DatePicker label="Move-in date" value="2026-06-15" onChange={vi.fn()} />);
    const dialog = await openCalendar(user);
    await user.keyboard('{ArrowRight}');
    expect(within(dialog).getByRole('button', { name: /16 June 2026/ })).toHaveFocus();
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(within(dialog).getByRole('button', { name: /14 June 2026/ })).toHaveFocus();
  });

  it('moves focus by week with ArrowDown / ArrowUp', async () => {
    const user = userEvent.setup();
    render(<DatePicker label="Move-in date" value="2026-06-15" onChange={vi.fn()} />);
    const dialog = await openCalendar(user);
    await user.keyboard('{ArrowDown}');
    expect(within(dialog).getByRole('button', { name: '22 June 2026' })).toHaveFocus();
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(within(dialog).getByRole('button', { name: '8 June 2026' })).toHaveFocus();
  });

  it('crosses the month boundary when arrowing past the end of the month', async () => {
    const user = userEvent.setup();
    render(<DatePicker label="Move-in date" value="2026-06-30" onChange={vi.fn()} />);
    const dialog = await openCalendar(user);
    await user.keyboard('{ArrowRight}');
    // 30 June -> 1 July; the grid should now show July and focus the 1st
    expect(within(dialog).getByText(/July 2026/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '1 July 2026' })).toHaveFocus();
  });

  it('changes month with PageDown / PageUp keeping the day of month', async () => {
    const user = userEvent.setup();
    render(<DatePicker label="Move-in date" value="2026-06-15" onChange={vi.fn()} />);
    const dialog = await openCalendar(user);
    await user.keyboard('{PageDown}');
    expect(within(dialog).getByText(/July 2026/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /15 July 2026/ })).toHaveFocus();
    await user.keyboard('{PageUp}{PageUp}');
    expect(within(dialog).getByText(/May 2026/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /15 May 2026/ })).toHaveFocus();
  });

  it('selects the focused day with Enter', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DatePicker label="Move-in date" value="2026-06-15" onChange={onChange} />);
    await openCalendar(user);
    await user.keyboard('{ArrowRight}{Enter}');
    expect(onChange).toHaveBeenCalledWith('2026-06-16');
  });

  it('selects the focused day with Space', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DatePicker label="Move-in date" value="2026-06-15" onChange={onChange} />);
    await openCalendar(user);
    await user.keyboard('{ArrowDown}{ }');
    expect(onChange).toHaveBeenCalledWith('2026-06-22');
  });

  it('closes on Escape and restores focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<DatePicker label="Move-in date" value="2026-06-15" onChange={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: /choose date|change date/i });
    await openCalendar(user);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('disables days before min and after max', async () => {
    const user = userEvent.setup();
    render(
      <DatePicker
        label="Move-in date"
        value="2026-06-15"
        onChange={vi.fn()}
        min="2026-06-10"
        max="2026-06-20"
      />,
    );
    const dialog = await openCalendar(user);
    const before = within(dialog).getByRole('button', { name: '9 June 2026' });
    const after = within(dialog).getByRole('button', { name: '21 June 2026' });
    const inRange = within(dialog).getByRole('button', { name: '12 June 2026' });
    expect(before).toBeDisabled();
    expect(before).toHaveAttribute('aria-disabled', 'true');
    expect(after).toBeDisabled();
    expect(inRange).not.toBeDisabled();
  });

  it('does not fire onChange when an out-of-range day is clicked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <DatePicker
        label="Move-in date"
        value="2026-06-15"
        onChange={onChange}
        min="2026-06-10"
        max="2026-06-20"
      />,
    );
    const dialog = await openCalendar(user);
    await user.click(within(dialog).getByRole('button', { name: '9 June 2026' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('opens to the current month when no value is set', async () => {
    const now = new Date();
    const monthYear = now.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
    const user = userEvent.setup();
    render(<DatePicker label="Move-in date" value={null} onChange={vi.fn()} />);
    const dialog = await openCalendar(user);
    expect(within(dialog).getByText(monthYear)).toBeInTheDocument();
  });

  it('renders a hint linked via aria-describedby', async () => {
    const user = userEvent.setup();
    render(
      <DatePicker
        id="movein"
        label="Move-in date"
        value={null}
        onChange={vi.fn()}
        hint="We need at least 48 hours' notice"
      />,
    );
    const trigger = screen.getByRole('button', { name: /choose date/i });
    const describedBy = trigger.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(
      document.getElementById((describedBy as string).split(' ')[0] as string),
    ).toHaveTextContent("We need at least 48 hours' notice");
    // does not open on render
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    void user;
  });

  it('surfaces an error via role=alert linked to the trigger', () => {
    render(
      <DatePicker
        label="Move-in date"
        value={null}
        onChange={vi.fn()}
        error="Please choose a date"
      />,
    );
    const trigger = screen.getByRole('button', { name: /choose date/i });
    // status conveyed beyond colour: a live-region alert + the danger class
    expect(trigger).toHaveClass('is-error');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Please choose a date');
    // the error is linked to the trigger via aria-describedby (read by AT)
    const describedBy = trigger.getAttribute('aria-describedby');
    expect(describedBy).toContain(alert.id);
  });

  it('has no detectable axe-core violations when closed', async () => {
    const { container } = render(
      <DatePicker label="Move-in date" value="2026-06-15" onChange={vi.fn()} hint="Optional" />,
    );
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });

  it('has no detectable axe-core violations with the calendar open', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <DatePicker label="Move-in date" value="2026-06-15" onChange={vi.fn()} />,
    );
    await openCalendar(user);
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });
});
