import {
  forwardRef,
  useId,
  type ForwardedRef,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';
import './FormStatus.css';

/**
 * One structured error: a message plus the optional id of the field it relates
 * to. When `field` is present the message is rendered as an in-page anchor
 * (`href="#<field>"`) so keyboard and screen-reader users can jump straight to
 * the offending control (the error-summary pattern from
 * design/canvas/states/error-state-patterns.html, "field & form level").
 */
export interface FormErrorItem {
  /** Id of the control this error relates to. Renders the message as a `#`-link. */
  field?: string;
  /** The error message shown to the user. */
  message: ReactNode;
}

export interface FormErrorProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'title'> {
  /**
   * The errors to summarise. Either plain strings or {@link FormErrorItem}s.
   * When empty the component renders nothing (no empty alert is announced).
   */
  errors: ReadonlyArray<string | FormErrorItem>;
  /**
   * Heading shown above the list. Defaults to a calm, non-blaming summary line
   * (PRODUCT.md §7 — "calm in crisis"; acknowledge, don't blame).
   */
  title?: ReactNode;
}

/** Join class-name fragments, dropping any falsy ones. */
function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** Narrow a list entry to the structured shape. */
function isItem(entry: string | FormErrorItem): entry is FormErrorItem {
  return typeof entry !== 'string';
}

/**
 * FormError — a form-level error summary. Ported from the "field & form level"
 * pattern in `design/canvas/states/error-state-patterns.html`. Token-driven via
 * `FormStatus.css` (G7) and accessible by construction (G9): the whole summary
 * is a `role="alert"` (assertive) live region, it is focusable (`tabIndex={-1}`)
 * so a form can move focus to it on a failed submit, and each error that names a
 * field renders as a real in-page link to that control.
 *
 * Renders nothing when `errors` is empty, so callers can mount it
 * unconditionally and let the data decide whether a summary appears.
 */
export const FormError = forwardRef(function FormError(
  { errors, title, className, ...rest }: FormErrorProps,
  ref: ForwardedRef<HTMLDivElement>,
): ReactElement | null {
  const headingId = useId();

  if (errors.length === 0) {
    return null;
  }

  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      aria-labelledby={headingId}
      className={cx('form-error', className)}
      {...rest}
    >
      <span className="form-error__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v6M12 16h.01" />
        </svg>
      </span>

      <div className="form-error__body">
        <h2 id={headingId} className="form-error__title">
          {title ?? 'There is a problem'}
        </h2>

        <ul className="form-error__list">
          {errors.map((entry, index) => {
            const key = isItem(entry) ? `${entry.field ?? 'general'}-${index}` : `msg-${index}`;
            if (isItem(entry) && entry.field != null) {
              return (
                <li key={key}>
                  <a className="form-error__link" href={`#${entry.field}`}>
                    {entry.message}
                  </a>
                </li>
              );
            }
            return <li key={key}>{isItem(entry) ? entry.message : entry}</li>;
          })}
        </ul>
      </div>
    </div>
  );
});
