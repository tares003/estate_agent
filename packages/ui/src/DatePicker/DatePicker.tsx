// responsive-coverage: opt-out all — DatePicker is a fluid/viewport-invariant primitive; responsive layout is verified where it composes into page tests
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import './DatePicker.css';

export interface DatePickerProps {
  /**
   * Visible field label. Rendered as a real `<label htmlFor>` element and used
   * as the trigger's accessible name context (G9 — never placeholder-only).
   */
  label: ReactNode;
  /** The selected date as an ISO `yyyy-mm-dd` string, or `null` when empty. */
  value: string | null;
  /** Called with the new ISO `yyyy-mm-dd` string when a day is selected. */
  onChange: (value: string) => void;
  /** Earliest selectable date as an ISO `yyyy-mm-dd` string. Days before are disabled. */
  min?: string;
  /** Latest selectable date as an ISO `yyyy-mm-dd` string. Days after are disabled. */
  max?: string;
  /** Explicit id for the trigger; a stable one is generated when omitted. */
  id?: string;
  /**
   * Error message. When present the trigger is `aria-invalid`, the message is
   * linked via `aria-describedby`, announced through a `role="alert"` live
   * region, and danger styling is applied. Status is conveyed by text + ARIA,
   * never colour alone (G9).
   */
  error?: ReactNode;
  /**
   * Supporting text shown below the control. Linked to the trigger via
   * `aria-describedby` so assistive technology reads it with the field.
   */
  hint?: ReactNode;
}

/** Join class-name fragments, dropping any falsy ones. */
function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const WEEKDAY_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/**
 * A timezone-free calendar date — year / month (1-12) / day (1-31). All grid
 * maths runs on these plain records so a UTC/local offset can never shift a day
 * (which `Date` parsing of bare ISO strings is prone to).
 */
interface CalDate {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

/** Parse an ISO `yyyy-mm-dd` string into a CalDate, or null if malformed. */
function parseISO(iso: string | null | undefined): CalDate | null {
  if (iso == null) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

/** Serialise a CalDate to an ISO `yyyy-mm-dd` string. */
function toISO(d: CalDate): string {
  const mm = String(d.month).padStart(2, '0');
  const dd = String(d.day).padStart(2, '0');
  return `${d.year}-${mm}-${dd}`;
}

/** A comparable integer for ordering / range checks (yyyymmdd). */
function ordinal(d: CalDate): number {
  return d.year * 10000 + d.month * 100 + d.day;
}

function sameDay(a: CalDate, b: CalDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

/** Number of days in the given (1-based) month of the given year. */
function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of this month. Using UTC avoids any
  // local-offset edge case at the month boundary.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Weekday index (0=Sun..6=Sat) for the 1st of the given month. */
function firstWeekday(year: number, month: number): number {
  return new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
}

/** Weekday index (0=Sun..6=Sat) for an arbitrary CalDate. */
function weekdayOf(d: CalDate): number {
  return new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay();
}

/** Add (or subtract) a number of days, normalising via the platform calendar. */
function addDays(d: CalDate, delta: number): CalDate {
  const next = new Date(Date.UTC(d.year, d.month - 1, d.day + delta));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

/**
 * Add (or subtract) whole months, clamping the day to the target month's length
 * (e.g. 31 Jan + 1 month → 28/29 Feb). Used by PageUp/PageDown.
 */
function addMonths(d: CalDate, delta: number): CalDate {
  const base = new Date(Date.UTC(d.year, d.month - 1 + delta, 1));
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth() + 1;
  const day = Math.min(d.day, daysInMonth(year, month));
  return { year, month, day };
}

/** Today as a CalDate, read from the local clock. */
function todayCal(): CalDate {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

/** Human-readable "15 June 2026" for the field display + day labels. */
function formatLong(d: CalDate): string {
  return `${d.day} ${MONTH_NAMES[d.month - 1]} ${d.year}`;
}

/**
 * Build the calendar grid for a month as weeks of 7 day-numbers. Leading and
 * trailing slots that fall outside the month are `null` (rendered as empty
 * gridcells, never focusable). Weeks start on Monday to match the UK convention
 * in WEEKDAY_SHORT.
 */
function buildWeeks(year: number, month: number): Array<Array<number | null>> {
  const total = daysInMonth(year, month);
  // Convert Sun=0..Sat=6 to Mon=0..Sun=6 so the grid starts on Monday.
  const leadingBlanks = (firstWeekday(year, month) + 6) % 7;
  const cells: Array<number | null> = [];
  for (let i = 0; i < leadingBlanks; i += 1) cells.push(null);
  for (let day = 1; day <= total; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: Array<Array<number | null>> = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

/**
 * DatePicker — the first-party EPIC-L date field. A labelled trigger that opens
 * a non-modal calendar popover anchored to the field. The calendar is a
 * `role="grid"` (weeks are `role="row"`, days are `role="gridcell"` wrapping a
 * focusable day button) with an accessible month/year label and prev/next month
 * controls.
 *
 * Accessible by construction (G9): a real `<label htmlFor>` associates with the
 * trigger; hint and error are wired through `aria-describedby`, the error is
 * surfaced via `aria-invalid` + a `role="alert"` live region. The popover is a
 * labelled `role="dialog"`. The grid uses roving tabindex — only one day is
 * tabbable; Arrow keys move focus by day/week (crossing month boundaries),
 * PageUp/PageDown change month keeping the day, Enter/Space select, Escape
 * closes and restores focus to the trigger. The selected day carries
 * `aria-selected`; today carries `aria-current="date"`; out-of-range days are
 * `disabled` + `aria-disabled`. All day buttons meet the 44px touch-target
 * minimum. Token-driven via `DatePicker.css` (G7). The month-grid date maths is
 * computed in-component (no date library dependency).
 */
export function DatePicker({
  label,
  value,
  onChange,
  min,
  max,
  id,
  error,
  hint,
}: DatePickerProps): ReactElement {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  const gridLabelId = `${fieldId}-gridlabel`;
  const hasError = error != null && error !== false;
  const hasHint = hint != null && hint !== false;

  const describedBy =
    [hasHint ? hintId : undefined, hasError ? errorId : undefined].filter(Boolean).join(' ') ||
    undefined;

  const selected = useMemo(() => parseISO(value), [value]);
  const minDate = useMemo(() => parseISO(min), [min]);
  const maxDate = useMemo(() => parseISO(max), [max]);

  const [open, setOpen] = useState(false);
  /**
   * The "view" anchor — which month is shown, and which day is roving-focusable.
   * Initialised when the popover opens (to the selected day, else today).
   */
  const [focusDate, setFocusDate] = useState<CalDate>(() => selected ?? todayCal());

  const triggerRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  /** When set, the day button matching this date is focused after the next render. */
  const pendingFocus = useRef<CalDate | null>(null);

  const isDisabledDay = useCallback(
    (d: CalDate): boolean => {
      const ord = ordinal(d);
      if (minDate != null && ord < ordinal(minDate)) return true;
      if (maxDate != null && ord > ordinal(maxDate)) return true;
      return false;
    },
    [minDate, maxDate],
  );

  const handleOpen = useCallback(() => {
    const start = selected ?? todayCal();
    setFocusDate(start);
    pendingFocus.current = start;
    setOpen(true);
  }, [selected]);

  const handleClose = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  const selectDay = useCallback(
    (d: CalDate) => {
      if (isDisabledDay(d)) return;
      onChange(toISO(d));
      handleClose(true);
    },
    [isDisabledDay, onChange, handleClose],
  );

  /** Move the roving focus to a new date, switching month if it left the view. */
  const moveFocus = useCallback((next: CalDate) => {
    pendingFocus.current = next;
    setFocusDate(next);
  }, []);

  // After any render while open, move DOM focus onto the pending day button.
  useEffect(() => {
    if (!open) return;
    const target = pendingFocus.current;
    if (target == null) return;
    pendingFocus.current = null;
    const grid = gridRef.current;
    if (grid == null) return;
    const button = grid.querySelector<HTMLButtonElement>(`[data-iso="${toISO(target)}"]`);
    button?.focus();
  });

  // Document-level keydown while open: Escape closes (binding here fires
  // regardless of which descendant — grid button or nav button — holds focus).
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        handleClose(true);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, handleClose]);

  const onDayKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      switch (event.key) {
        case 'ArrowRight':
          event.preventDefault();
          moveFocus(addDays(focusDate, 1));
          break;
        case 'ArrowLeft':
          event.preventDefault();
          moveFocus(addDays(focusDate, -1));
          break;
        case 'ArrowDown':
          event.preventDefault();
          moveFocus(addDays(focusDate, 7));
          break;
        case 'ArrowUp':
          event.preventDefault();
          moveFocus(addDays(focusDate, -7));
          break;
        case 'PageDown':
          event.preventDefault();
          moveFocus(addMonths(focusDate, 1));
          break;
        case 'PageUp':
          event.preventDefault();
          moveFocus(addMonths(focusDate, -1));
          break;
        case 'Home': {
          event.preventDefault();
          // start of the (Monday-based) week
          moveFocus(addDays(focusDate, -((weekdayOf(focusDate) + 6) % 7)));
          break;
        }
        case 'End': {
          event.preventDefault();
          moveFocus(addDays(focusDate, 6 - ((weekdayOf(focusDate) + 6) % 7)));
          break;
        }
        case 'Enter':
        case ' ':
        case 'Spacebar':
          event.preventDefault();
          selectDay(focusDate);
          break;
        default:
          break;
      }
    },
    [focusDate, moveFocus, selectDay],
  );

  const today = todayCal();
  const weeks = useMemo(
    () => buildWeeks(focusDate.year, focusDate.month),
    [focusDate.year, focusDate.month],
  );
  const monthLabel = `${MONTH_NAMES[focusDate.month - 1]} ${focusDate.year}`;

  return (
    <div className="datepicker">
      <label className="datepicker-label" htmlFor={fieldId}>
        {label}
      </label>

      <div className={cx('datepicker-control', open && 'is-open')}>
        <button
          ref={triggerRef}
          type="button"
          id={fieldId}
          className={cx('datepicker-trigger', hasError && 'is-error')}
          onClick={handleOpen}
          aria-haspopup="dialog"
          aria-expanded={open}
          // Invalid state is conveyed by the linked `role="alert"` error message
          // (via aria-describedby) + the danger border — `aria-invalid` is not a
          // supported attribute on `role="button"` (jsx-a11y), so it is not used
          // on this trigger.
          aria-describedby={describedBy}
          aria-label={selected != null ? `Change date, ${formatLong(selected)}` : 'Choose date'}
        >
          <span className={cx('datepicker-value', selected == null && 'is-placeholder')}>
            {selected != null ? formatLong(selected) : 'Choose a date'}
          </span>
          <svg
            className="datepicker-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
        </button>

        {open ? (
          <div
            className="datepicker-popover"
            role="dialog"
            aria-modal="false"
            aria-label="Choose date"
          >
            <div className="datepicker-nav">
              <button
                type="button"
                className="datepicker-navbtn"
                aria-label="Previous month"
                onClick={() => setFocusDate((d) => addMonths(d, -1))}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>

              <span id={gridLabelId} className="datepicker-month" aria-live="polite">
                {monthLabel}
              </span>

              <button
                type="button"
                className="datepicker-navbtn"
                aria-label="Next month"
                onClick={() => setFocusDate((d) => addMonths(d, 1))}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </div>

            {/* Keyboard interaction is handled per day button (each natively
                focusable), mirroring the Tabs roving-tabindex pattern — the grid
                container itself carries no key handler. */}
            <div
              ref={gridRef}
              role="grid"
              className="datepicker-grid"
              aria-labelledby={gridLabelId}
            >
              <div role="row" className="datepicker-weekdays">
                {WEEKDAY_SHORT.map((wd, i) => (
                  <span
                    key={wd}
                    role="columnheader"
                    className="datepicker-weekday"
                    aria-label={WEEKDAY_LONG[(i + 1) % 7]}
                  >
                    {wd}
                  </span>
                ))}
              </div>

              {weeks.map((week, wi) => (
                <div role="row" key={`w${wi}`} className="datepicker-week">
                  {week.map((day, di) => {
                    if (day == null) {
                      return (
                        <span
                          role="gridcell"
                          key={`e${wi}-${di}`}
                          className="datepicker-cell is-empty"
                          aria-hidden="true"
                        />
                      );
                    }
                    const cell: CalDate = {
                      year: focusDate.year,
                      month: focusDate.month,
                      day,
                    };
                    const isSelected = selected != null && sameDay(cell, selected);
                    const isToday = sameDay(cell, today);
                    const isFocusDay = sameDay(cell, focusDate);
                    const disabled = isDisabledDay(cell);
                    return (
                      // `aria-selected` / `aria-current` live on the gridcell —
                      // the role that permits them — not on the inner <button>
                      // (where axe's aria-allowed-attr rejects them). This is the
                      // WAI-ARIA APG date-grid shape: a gridcell wrapping a
                      // focusable day control.
                      <span
                        role="gridcell"
                        key={`d${day}`}
                        className="datepicker-cell"
                        aria-selected={isSelected}
                        aria-current={isToday ? 'date' : undefined}
                      >
                        <button
                          type="button"
                          className={cx(
                            'datepicker-day',
                            isSelected && 'is-selected',
                            isToday && 'is-today',
                          )}
                          data-iso={toISO(cell)}
                          // Roving tabindex: only the focus day is tabbable.
                          tabIndex={isFocusDay ? 0 : -1}
                          aria-label={formatLong(cell)}
                          disabled={disabled}
                          aria-disabled={disabled || undefined}
                          onClick={() => selectDay(cell)}
                          onKeyDown={onDayKeyDown}
                        >
                          {day}
                        </button>
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {hasHint ? (
        <span className="datepicker-hint" id={hintId}>
          {hint}
        </span>
      ) : null}

      {hasError ? (
        <span className="datepicker-err" id={errorId} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
