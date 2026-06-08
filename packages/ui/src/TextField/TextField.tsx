'use client';

import {
  forwardRef,
  useId,
  type ForwardedRef,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';
import './TextField.css';

/**
 * Props shared by `TextField` and its typed siblings. Extends the native input
 * attributes minus the props this atom owns (`type` is fixed by each sibling).
 */
export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'children'> {
  /**
   * Visible field label. Rendered as a real `<label htmlFor>` element and used
   * as the input's accessible name (G9 — never placeholder-only).
   */
  label: ReactNode;
  /**
   * Supporting text shown below the control. Linked to the input via
   * `aria-describedby` so assistive technology reads it with the field.
   */
  hint?: ReactNode;
  /**
   * Error message. When present the input is `aria-invalid`, the message is
   * linked via `aria-describedby`, announced through a `role="alert"` live
   * region, and the danger styling (`--colour-danger`) is applied. Status is
   * conveyed by text + ARIA, never colour alone (G9).
   */
  error?: ReactNode;
  /** Decorative content rendered before the input (e.g. a `+44` prefix). */
  leadingAdornment?: ReactNode;
  /** Decorative content rendered after the input (e.g. a search icon). */
  trailingAdornment?: ReactNode;
}

/** Join class-name fragments, dropping any falsy ones. */
function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/**
 * TextField — the first-party EPIC-L text-input atom. Ported from
 * `design/canvas/components/atoms/form-fields.html`. Fully token-driven via
 * `TextField.css` (G7) and accessible by construction (G9): a real
 * `<label htmlFor>`, hint and error wired through `aria-describedby`, the error
 * surfaced via `aria-invalid` + a `role="alert"` live region, and a 48px
 * (`--size-input-md`) control that clears the touch-target minimum.
 *
 * Generates a stable id with `useId` when none is supplied so the label always
 * associates with its input.
 */
export const TextField = forwardRef(function TextField(
  {
    label,
    hint,
    error,
    leadingAdornment,
    trailingAdornment,
    id,
    type = 'text',
    required = false,
    disabled = false,
    className,
    ...rest
  }: TextFieldProps,
  ref: ForwardedRef<HTMLInputElement>,
): ReactElement {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  const hasError = error != null && error !== false;

  // Compose aria-describedby from whichever messages are present.
  const describedBy =
    [hint != null && hint !== false ? hintId : undefined, hasError ? errorId : undefined]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <div className="field">
      <label htmlFor={fieldId}>
        {label}
        {required ? <span className="req"> (required)</span> : null}
      </label>

      <div className={cx('inputwrap', hasError && 'is-error', disabled && 'is-disabled')}>
        {leadingAdornment != null && leadingAdornment !== false ? (
          <span className="adornment leading" aria-hidden="true">
            {leadingAdornment}
          </span>
        ) : null}

        <input
          ref={ref}
          id={fieldId}
          type={type}
          className={cx('control', hasError && 'is-error', className)}
          required={required}
          disabled={disabled}
          aria-invalid={hasError}
          aria-describedby={describedBy}
          {...rest}
        />

        {trailingAdornment != null && trailingAdornment !== false ? (
          <span className="adornment trailing" aria-hidden="true">
            {trailingAdornment}
          </span>
        ) : null}
      </div>

      {hint != null && hint !== false ? (
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

/** Props for the typed siblings: the `type` is owned by each wrapper. */
export type TypedFieldProps = Omit<TextFieldProps, 'type'>;

/**
 * EmailField — `TextField` fixed to `type="email"` with `inputMode="email"`
 * so mobile keyboards surface the `@` and `.` keys.
 */
export const EmailField = forwardRef(function EmailField(
  props: TypedFieldProps,
  ref: ForwardedRef<HTMLInputElement>,
): ReactElement {
  return <TextField ref={ref} type="email" inputMode="email" {...props} />;
});

/**
 * PhoneField — `TextField` fixed to `type="tel"` with `inputMode="tel"` for the
 * telephone keypad.
 */
export const PhoneField = forwardRef(function PhoneField(
  props: TypedFieldProps,
  ref: ForwardedRef<HTMLInputElement>,
): ReactElement {
  return <TextField ref={ref} type="tel" inputMode="tel" {...props} />;
});

/**
 * NumberField — `TextField` fixed to `type="number"` with `inputMode="numeric"`
 * for the numeric keypad.
 */
export const NumberField = forwardRef(function NumberField(
  props: TypedFieldProps,
  ref: ForwardedRef<HTMLInputElement>,
): ReactElement {
  return <TextField ref={ref} type="number" inputMode="numeric" {...props} />;
});
