'use client';

import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type ForwardedRef,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';
import './Checkbox.css';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** The visible, associated label. Required — never placeholder-only (G9). */
  label: ReactNode;
  /** Optional supporting copy rendered beneath the label and linked via aria-describedby. */
  description?: ReactNode;
  /**
   * Tri-state "mixed" value used by select-all controls. Sets the DOM
   * `indeterminate` property (not an HTML attribute) and announces
   * `aria-checked="mixed"`, so the state is conveyed beyond colour alone (G9).
   */
  indeterminate?: boolean;
  /** Validation message. Sets `aria-invalid` and is linked via `aria-describedby` (G9). */
  error?: ReactNode;
}

/** Join class-name fragments, dropping any falsy ones. */
function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** Merge a forwarded ref with a local ref so the component can both expose and read the node. */
function setRef<T>(ref: ForwardedRef<T>, value: T | null): void {
  if (typeof ref === 'function') {
    ref(value);
  } else if (ref) {
    ref.current = value;
  }
}

/**
 * Checkbox — the first-party EPIC-L selection atom. Renders a real
 * `<input type="checkbox">` under a token-driven visual box, wrapped by its
 * `<label>` so the whole row is a ≥44px hit target (`--size-touch-target-min`).
 * Fully token-driven via `Checkbox.css` (G7); checked / indeterminate / disabled
 * / error states and the focus ring all reference design tokens. Accessible by
 * construction (G9): explicit label association, `aria-invalid` + `aria-describedby`
 * for errors via a live region, and `aria-checked="mixed"` for the indeterminate state.
 */
export const Checkbox = forwardRef(function Checkbox(
  {
    label,
    description,
    indeterminate = false,
    error,
    id,
    disabled = false,
    className,
    'aria-describedby': ariaDescribedBy,
    ...rest
  }: CheckboxProps,
  forwardedRef: ForwardedRef<HTMLInputElement>,
): ReactElement {
  const localRef = useRef<HTMLInputElement | null>(null);
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = `${inputId}-description`;
  const errorId = `${inputId}-error`;
  const hasError = error != null && error !== false;

  // `indeterminate` is a DOM property with no HTML attribute equivalent; sync it
  // on every render that changes it, against the real input node.
  useEffect(() => {
    if (localRef.current) {
      localRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  const describedBy =
    [description != null ? descriptionId : null, hasError ? errorId : null, ariaDescribedBy]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <div className={cx('checkbox-field', hasError && 'has-error', className)}>
      <label className="checkbox-row" htmlFor={inputId}>
        <input
          ref={(node) => {
            localRef.current = node;
            setRef(forwardedRef, node);
          }}
          id={inputId}
          type="checkbox"
          className="checkbox-input"
          disabled={disabled}
          aria-invalid={hasError}
          aria-checked={indeterminate ? 'mixed' : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
        <span className="checkbox-box" aria-hidden="true">
          <svg
            className="checkbox-tick"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
          <span className="checkbox-dash" />
        </span>
        <span className="checkbox-text">
          <span className="checkbox-label">{label}</span>
          {description != null ? (
            <span className="checkbox-description" id={descriptionId}>
              {description}
            </span>
          ) : null}
        </span>
      </label>
      {hasError ? (
        <span className="checkbox-error" id={errorId} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
});
