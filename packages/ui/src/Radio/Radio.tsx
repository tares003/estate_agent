'use client';

import {
  createContext,
  forwardRef,
  useContext,
  useId,
  type ForwardedRef,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';
import './Radio.css';

/** Join class-name fragments, dropping any falsy ones. */
function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/**
 * Context shared from a `RadioGroup` down to each `Radio`. A `Radio` is
 * meaningless on its own — it derives its `name`, checked-state, change handler
 * and group-level disabled flag from the enclosing group, exactly as a native
 * radio set does. `null` means a `Radio` was rendered outside a `RadioGroup`.
 */
interface RadioGroupContextValue {
  /** Shared `name` so the browser treats the inputs as one mutually-exclusive set. */
  name: string;
  /** The currently-selected option value. */
  value: string;
  /** Called with the newly-selected option value. */
  onChange: (value: string) => void;
  /** When true, every option in the group is disabled. */
  disabled: boolean;
  /** When true, the group is required (mirrored onto every input). */
  required: boolean;
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

export interface RadioProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'name' | 'checked' | 'value' | 'onChange'
> {
  /** The value this option contributes to the group when selected. */
  value: string;
  /** Visible label text. Rendered inside the wrapping `<label>` so the whole row is the hit target. */
  label: ReactNode;
  /** Optional supporting line shown beneath the label. */
  description?: ReactNode;
  /** Disable just this option (independent of the group-level `disabled`). */
  disabled?: boolean;
}

/**
 * Radio — a single option in a `RadioGroup`. Renders a real
 * `<input type="radio">` visually hidden beneath a token-driven `.dot`, wrapped
 * in a `<label>` so the whole ≥44px row is the hit target (G9). Must be rendered
 * inside a `RadioGroup`, which supplies the shared name, selection and handler.
 */
export const Radio = forwardRef(function Radio(
  { value, label, description, disabled = false, className, ...rest }: RadioProps,
  ref: ForwardedRef<HTMLInputElement>,
): ReactElement {
  const group = useContext(RadioGroupContext);
  if (group === null) {
    throw new Error('<Radio> must be rendered inside a <RadioGroup>.');
  }

  const descriptionId = useId();
  const isDisabled = disabled || group.disabled;

  return (
    <label className={cx('radio', isDisabled && 'is-disabled', className)}>
      <input
        ref={ref}
        type="radio"
        className="radio-input"
        name={group.name}
        value={value}
        checked={group.value === value}
        disabled={isDisabled}
        required={group.required}
        aria-describedby={description ? descriptionId : undefined}
        onChange={(event) => {
          if (event.target.checked) {
            group.onChange(value);
          }
        }}
        {...rest}
      />
      <span className="dot" aria-hidden="true" />
      <span className="radio-text">
        <span className="radio-label">{label}</span>
        {description ? (
          <span className="radio-description" id={descriptionId}>
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
});

export interface RadioGroupProps {
  /** Shared HTML `name` for the radio set. */
  name: string;
  /** Accessible group label, rendered as the fieldset's `<legend>`. */
  label: ReactNode;
  /** Currently-selected option value (controlled). */
  value: string;
  /** Called with the newly-selected option value. */
  onChange: (value: string) => void;
  /** `Radio` children. */
  children: ReactNode;
  /** Disable every option in the group. */
  disabled?: boolean;
  /** Mark the group as required. */
  required?: boolean;
  /** Help text shown beneath the options and wired to the group via `aria-describedby`. */
  helpText?: ReactNode;
  /**
   * Error message. When present the group is marked `aria-invalid` and the
   * message is announced via `role="alert"` and linked via `aria-describedby`.
   * Status is conveyed by the text itself, not by colour alone (G9).
   */
  error?: ReactNode;
  /** Extra class applied to the fieldset. */
  className?: string;
}

/**
 * RadioGroup — the accessible container for a set of `Radio` options. Renders a
 * `<fieldset role="radiogroup">` with the group label as its `<legend>` (G9),
 * shares the name / selection / handler with its children via context, and
 * wires optional help and error text through `aria-describedby`. Keyboard arrow
 * navigation is provided natively by the grouped `<input type="radio">`s.
 */
export function RadioGroup({
  name,
  label,
  value,
  onChange,
  children,
  disabled = false,
  required = false,
  helpText,
  error,
  className,
}: RadioGroupProps): ReactElement {
  const helpId = useId();
  const errorId = useId();
  const hasError = error !== undefined && error !== null && error !== false;

  const describedBy =
    cx(helpText ? helpId : undefined, hasError ? errorId : undefined) || undefined;

  return (
    <fieldset
      className={cx('radio-group', className)}
      role="radiogroup"
      aria-required={required || undefined}
      aria-invalid={hasError || undefined}
      aria-describedby={describedBy}
    >
      <legend className="radio-group-legend">{label}</legend>
      <div className="radio-group-options">
        <RadioGroupContext.Provider value={{ name, value, onChange, disabled, required }}>
          {children}
        </RadioGroupContext.Provider>
      </div>
      {helpText ? (
        <p className="radio-group-help" id={helpId}>
          {helpText}
        </p>
      ) : null}
      {hasError ? (
        <p className="radio-group-error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
