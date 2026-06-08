import { useId, type ReactElement, type ReactNode } from 'react';
import './TimeSlotSelector.css';

/** Join class-name fragments, dropping any falsy ones. */
function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** A single selectable time slot. */
export interface TimeSlot {
  /** The value this slot contributes when selected (e.g. an ISO time or slot id). */
  value: string;
  /** Visible, accessible label for the chip (e.g. "9:00 AM"). */
  label: ReactNode;
  /** When true the slot is shown but cannot be selected (e.g. fully booked). */
  disabled?: boolean;
}

export interface TimeSlotSelectorProps {
  /**
   * Accessible group label, rendered as the `<legend>` of the wrapping
   * `<fieldset>` and used as the radiogroup's accessible name (G9 — never
   * placeholder-only).
   */
  legend: ReactNode;
  /**
   * Shared HTML `name` for the radio set so the browser treats the chips as one
   * mutually-exclusive group (and submits one value in a form). A stable id is
   * generated when omitted.
   */
  name?: string;
  /** The selectable slots, rendered in order as real `<input type="radio">` chips. */
  slots: TimeSlot[];
  /** Currently-selected slot value (controlled). */
  value: string;
  /** Called with the newly-selected slot value. */
  onChange: (value: string) => void;
  /** Extra class applied to the fieldset. */
  className?: string;
}

/**
 * TimeSlotSelector — the EPIC-L time-slot selection primitive. Per
 * `design-requirements.md` §1 it is built from REAL `<input type="radio">`
 * inputs (not custom divs) styled as selectable chips, grouped in a
 * `<fieldset>` with a `<legend>` exposed as `role="radiogroup"` (G9). Each chip
 * is a `<label>` wrapping its input, so the whole ≥44px chip is the hit target
 * and the label is associated with the input by construction.
 *
 * Native grouped radios give arrow-key navigation, roving focus and the
 * mutually-exclusive single-selection contract for free — no custom keyboard
 * handling, no custom ARIA listbox. Selection is conveyed beyond colour by a
 * check mark on the chosen chip (G9). Fully token-driven via
 * `TimeSlotSelector.css` (G7).
 */
export function TimeSlotSelector({
  legend,
  name,
  slots,
  value,
  onChange,
  className,
}: TimeSlotSelectorProps): ReactElement {
  const generatedName = useId();
  const groupName = name ?? generatedName;

  return (
    <fieldset className={cx('time-slot-selector', className)} role="radiogroup">
      <legend className="time-slot-legend">{legend}</legend>
      <div className="time-slot-options">
        {slots.map((slot) => {
          const isSelected = value === slot.value;
          return (
            <label
              key={slot.value}
              className={cx(
                'time-slot',
                isSelected && 'is-selected',
                slot.disabled && 'is-disabled',
              )}
            >
              <input
                type="radio"
                className="time-slot-input"
                name={groupName}
                value={slot.value}
                checked={isSelected}
                disabled={slot.disabled ?? false}
                onChange={(event) => {
                  if (event.target.checked) {
                    onChange(slot.value);
                  }
                }}
              />
              <span className="time-slot-mark" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m5 12 5 5L20 7" />
                </svg>
              </span>
              <span className="time-slot-label">{slot.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
