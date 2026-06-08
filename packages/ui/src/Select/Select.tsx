'use client';

import {
  forwardRef,
  useId,
  type ForwardedRef,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import './Select.css';

/**
 * A single entry in the `options` array. Mirrors the native `<option>`
 * attributes the Select supports.
 */
export interface SelectOption {
  /** The value submitted when this option is chosen. */
  value: string;
  /** The visible, accessible label for the option. */
  label: string;
  /** When true the option is shown but cannot be selected. */
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  /**
   * Visible field label. Rendered as a real `<label htmlFor>` element and used
   * as the select's accessible name (G9 — never placeholder-only).
   */
  label: ReactNode;
  /**
   * Declarative option list. Each entry becomes an `<option>`. Provide this OR
   * `children`; if both are given, `options` is rendered after the placeholder.
   */
  options?: SelectOption[];
  /** Raw `<option>` children, for cases where the option list is composed by hand. */
  children?: ReactNode;
  /**
   * Optional prompt rendered as a disabled, hidden, empty-valued first option,
   * so an uncontrolled select starts with no real choice committed.
   */
  placeholder?: string;
  /**
   * Supporting text shown below the control. Linked to the select via
   * `aria-describedby` so assistive technology reads it with the field.
   */
  hint?: ReactNode;
  /**
   * Error message. When present the select is `aria-invalid`, the message is
   * linked via `aria-describedby`, announced through a `role="alert"` live
   * region, and the danger styling (`--colour-danger`) is applied. Status is
   * conveyed by text + ARIA, never colour alone (G9).
   */
  error?: ReactNode;
}

/** Join class-name fragments, dropping any falsy ones. */
function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/**
 * Select — the first-party EPIC-L selection atom. A styled NATIVE `<select>`,
 * which is accessible by default (the browser owns the listbox semantics and
 * keyboard interaction — no custom ARIA listbox is needed for V1). Ported from
 * `design/canvas/components/atoms/form-fields.html`. Fully token-driven via
 * `Select.css` (G7) — the native caret is suppressed and replaced by a
 * token-coloured chevron — and accessible by construction (G9): a real
 * `<label htmlFor>`, hint and error wired through `aria-describedby`, the error
 * surfaced via `aria-invalid` + a `role="alert"` live region, and a 48px
 * (`--size-input-md`) control that clears the touch-target minimum.
 *
 * Generates a stable id with `useId` when none is supplied so the label always
 * associates with its select.
 */
export const Select = forwardRef(function Select(
  {
    label,
    options,
    children,
    placeholder,
    hint,
    error,
    id,
    required = false,
    disabled = false,
    className,
    ...rest
  }: SelectProps,
  ref: ForwardedRef<HTMLSelectElement>,
): ReactElement {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  const hasError = error != null && error !== false;
  const hasHint = hint != null && hint !== false;

  // Compose aria-describedby from whichever messages are present.
  const describedBy =
    [hasHint ? hintId : undefined, hasError ? errorId : undefined].filter(Boolean).join(' ') ||
    undefined;

  return (
    <div className="select-field">
      <label htmlFor={fieldId}>
        {label}
        {required ? <span className="req"> (required)</span> : null}
      </label>

      <div className="selectwrap">
        <select
          ref={ref}
          id={fieldId}
          className={cx('control', hasError && 'is-error', className)}
          required={required}
          disabled={disabled}
          aria-invalid={hasError}
          aria-describedby={describedBy}
          {...rest}
        >
          {placeholder != null ? (
            <option value="" disabled hidden>
              {placeholder}
            </option>
          ) : null}
          {options != null
            ? options.map((option) => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </option>
              ))
            : children}
        </select>

        <svg
          className="select-caret"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>

      {hasHint ? (
        <span className="hint" id={hintId}>
          {hint}
        </span>
      ) : null}

      {hasError ? (
        <span className="err" id={errorId} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
});
