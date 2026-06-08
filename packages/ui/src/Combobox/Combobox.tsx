'use client';

// responsive-coverage: opt-out all — Combobox is a fluid/viewport-invariant primitive; responsive layout is verified where it composes into page tests
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import './Combobox.css';

/** A single selectable entry in the combobox popup. */
export interface ComboboxOption {
  /** The value reported to `onChange` when this option is chosen. */
  value: string;
  /** The visible, accessible label shown in the input and the listbox. */
  label: string;
}

export interface ComboboxProps {
  /**
   * Visible field label. Rendered as a real `<label htmlFor>` element and used
   * as the input's accessible name (G9 — never placeholder-only). It also names
   * the popup listbox via `aria-label`.
   */
  label: ReactNode;
  /** The full, unfiltered option list. */
  options: ComboboxOption[];
  /**
   * The currently-selected value (controlled). When it matches an option, the
   * input displays that option's label.
   */
  value: string;
  /** Called with the chosen option's `value` when the user makes a selection. */
  onChange: (value: string) => void;
  /** Placeholder shown in the empty input. Never the only label (G9). */
  placeholder?: string;
  /** Optional id for the input; a stable one is generated when omitted. */
  id?: string;
  /**
   * Supporting text shown below the control, linked via `aria-describedby` so
   * assistive technology reads it with the field.
   */
  hint?: ReactNode;
  /**
   * Error message. When present the input is `aria-invalid`, the message is
   * linked via `aria-describedby`, announced through a `role="alert"` live
   * region, and the danger styling is applied. Status is conveyed by text +
   * ARIA, never colour alone (G9).
   */
  error?: ReactNode;
}

/** Join class-name fragments, dropping any falsy ones. */
function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/**
 * Combobox — the first-party EPIC-L editable combobox, built to the ARIA 1.2
 * combobox pattern. A labelled text `<input role="combobox">` owns a popup
 * `role="listbox"` of `role="option"` items.
 *
 * Accessible by construction (G9): the input carries `aria-expanded`,
 * `aria-controls` -> the listbox, and `aria-activedescendant` tracking the
 * visually-highlighted option (the input keeps DOM focus throughout — options
 * are never focused, per the pattern). Filter-as-you-type narrows the list.
 * Keyboard: ArrowDown opens the popup and moves the highlight down (wrapping),
 * ArrowUp moves up (wrapping), Home/End jump to the first/last option, Enter
 * selects the highlighted option, Escape closes without selecting, Tab commits
 * focus elsewhere and closes. An outside pointer click also closes. Token-driven
 * via `Combobox.css` (G7); the toggle button clears the 44px touch-target
 * minimum.
 */
export function Combobox({
  label,
  options,
  value,
  onChange,
  placeholder,
  id,
  hint,
  error,
}: ComboboxProps): ReactElement {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const listboxId = `${fieldId}-listbox`;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  const optionId = (index: number): string => `${fieldId}-option-${index}`;

  const hasHint = hint != null && hint !== false;
  const hasError = error != null && error !== false;

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  // The raw text in the input. When closed it mirrors the selected label; while
  // typing it is the user's query that filters the list.
  const [query, setQuery] = useState('');
  // Index into the FILTERED list of the highlighted option (-1 = none).
  const [activeIndex, setActiveIndex] = useState(-1);

  /** The label of the currently-selected value, or '' if none matches. */
  const selectedLabel = useMemo(
    () => options.find((option) => option.value === value)?.label ?? '',
    [options, value],
  );

  // While the popup is closed, the input shows the selected label; while open,
  // it shows the live query the user is typing.
  const displayValue = open ? query : selectedLabel;

  /** Options narrowed by a case-insensitive substring match on the query. */
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === '') return options;
    return options.filter((option) => option.label.toLowerCase().includes(needle));
  }, [options, query]);

  const describedBy =
    [hasHint ? hintId : undefined, hasError ? errorId : undefined].filter(Boolean).join(' ') ||
    undefined;

  const closePopup = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  const openPopup = useCallback(() => {
    setOpen(true);
  }, []);

  const commitSelection = useCallback(
    (index: number) => {
      const option = filtered[index];
      if (!option) return;
      onChange(option.value);
      setQuery('');
      closePopup();
    },
    [filtered, onChange, closePopup],
  );

  // Outside-pointer-down closes the popup. Bound to the document so it fires for
  // clicks anywhere off the field; a click inside the field is ignored.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent): void => {
      const root = rootRef.current;
      if (root && event.target instanceof Node && !root.contains(event.target)) {
        closePopup();
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, closePopup]);

  // Keep the highlight within bounds as the filtered list changes (typing).
  useEffect(() => {
    if (!open) return;
    setActiveIndex((current) => {
      if (filtered.length === 0) return -1;
      if (current < 0) return -1;
      return Math.min(current, filtered.length - 1);
    });
  }, [filtered, open]);

  const moveHighlight = useCallback(
    (direction: 1 | -1) => {
      setActiveIndex((current) => {
        const count = filtered.length;
        if (count === 0) return -1;
        if (current < 0) return direction === 1 ? 0 : count - 1;
        return (current + direction + count) % count;
      });
    },
    [filtered.length],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>): void => {
      switch (event.key) {
        case 'ArrowDown': {
          event.preventDefault();
          if (!open) {
            openPopup();
            setActiveIndex(filtered.length > 0 ? 0 : -1);
          } else {
            moveHighlight(1);
          }
          break;
        }
        case 'ArrowUp': {
          event.preventDefault();
          if (!open) {
            openPopup();
            setActiveIndex(filtered.length > 0 ? filtered.length - 1 : -1);
          } else {
            moveHighlight(-1);
          }
          break;
        }
        case 'Home': {
          if (!open) break;
          event.preventDefault();
          setActiveIndex(filtered.length > 0 ? 0 : -1);
          break;
        }
        case 'End': {
          if (!open) break;
          event.preventDefault();
          setActiveIndex(filtered.length > 0 ? filtered.length - 1 : -1);
          break;
        }
        case 'Enter': {
          if (open && activeIndex >= 0) {
            event.preventDefault();
            commitSelection(activeIndex);
          }
          break;
        }
        case 'Escape': {
          if (open) {
            event.preventDefault();
            event.stopPropagation();
            setQuery('');
            closePopup();
          }
          break;
        }
        case 'Tab': {
          // Tab commits focus elsewhere — close the popup without selecting.
          if (open) closePopup();
          break;
        }
        default:
          break;
      }
    },
    [open, openPopup, moveHighlight, filtered.length, activeIndex, commitSelection, closePopup],
  );

  const onInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      setQuery(event.target.value);
      if (!open) setOpen(true);
      // Reset the highlight while filtering; the user re-arrows to choose.
      setActiveIndex(-1);
    },
    [open],
  );

  const onInputClick = useCallback(() => {
    openPopup();
  }, [openPopup]);

  const onToggleClick = useCallback(() => {
    if (open) {
      closePopup();
    } else {
      setOpen(true);
      inputRef.current?.focus();
    }
  }, [open, closePopup]);

  const activeDescendant = open && activeIndex >= 0 ? optionId(activeIndex) : undefined;

  return (
    <div className="combobox-field" ref={rootRef}>
      <label htmlFor={fieldId}>{label}</label>

      <div className="combobox-anchor">
        <div className={cx('combobox-control', open && 'is-open', hasError && 'is-error')}>
          <input
            ref={inputRef}
            id={fieldId}
            type="text"
            className="combobox-input"
            role="combobox"
            autoComplete="off"
            aria-expanded={open}
            aria-controls={open ? listboxId : undefined}
            aria-activedescendant={activeDescendant}
            aria-autocomplete="list"
            aria-invalid={hasError}
            aria-describedby={describedBy}
            placeholder={placeholder}
            value={displayValue}
            onChange={onInputChange}
            onClick={onInputClick}
            onKeyDown={onKeyDown}
          />
          <button
            type="button"
            className="combobox-toggle"
            tabIndex={-1}
            aria-label={open ? 'Close suggestions' : 'Show suggestions'}
            aria-expanded={open}
            aria-controls={open ? listboxId : undefined}
            onClick={onToggleClick}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>

        {open ? (
          <ul
            id={listboxId}
            role="listbox"
            className="combobox-popup"
            aria-label={typeof label === 'string' ? label : undefined}
          >
            {filtered.length === 0 ? (
              <li className="combobox-empty" role="presentation">
                No matches
              </li>
            ) : (
              filtered.map((option, index) => {
                const isActive = index === activeIndex;
                return (
                  // Per the ARIA 1.2 combobox pattern, options are NOT in the
                  // tab order and are never individually focused — the input
                  // keeps focus and keyboard selection runs through it (Enter on
                  // the active descendant). The onClick here is a redundant
                  // pointer affordance for that already-keyboard-operable
                  // control, so a per-option key listener would be dead code.
                  // eslint-disable-next-line jsx-a11y/click-events-have-key-events
                  <li
                    key={option.value}
                    id={optionId(index)}
                    role="option"
                    aria-selected={isActive}
                    className={cx('combobox-option', isActive && 'is-active')}
                    // Prevent the input losing focus on option mousedown so the
                    // outside-click handler doesn't fire before the click selects.
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => commitSelection(index)}
                  >
                    {option.label}
                  </li>
                );
              })
            )}
          </ul>
        ) : null}
      </div>

      {hasHint ? (
        <span className="combobox-hint" id={hintId}>
          {hint}
        </span>
      ) : null}

      {hasError ? (
        <span className="combobox-error" id={errorId} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
