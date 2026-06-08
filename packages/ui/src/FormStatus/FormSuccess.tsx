import {
  forwardRef,
  useId,
  type ForwardedRef,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';
import './FormStatus.css';

export interface FormSuccessProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /**
   * The confirmation headline (e.g. `"Your viewing is requested"`). Rendered as
   * a heading and used as the region's accessible name via `aria-labelledby`.
   */
  title: ReactNode;
  /**
   * Optional supporting line — what happens next and by when
   * (design-requirements §7 — "say what happens next").
   */
  message?: ReactNode;
  /**
   * Optional follow-on content rendered below the message, e.g. next-step
   * actions (a "Back to property" link) or a {@link FormReviewSummary}.
   */
  children?: ReactNode;
}

/** Join class-name fragments, dropping any falsy ones. */
function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/**
 * FormSuccess — a calm submission confirmation. Ported from the success-state
 * patterns in `design/canvas/states/success-state-patterns.html`. Token-driven
 * via `FormStatus.css` (G7) and accessible by construction (G9): the container
 * is a polite `role="status"` live region named by its heading via
 * `aria-labelledby`, so assistive technology announces the outcome without
 * stealing focus. No motion celebration — a credible, professional tone
 * (motion-spec §7).
 */
export const FormSuccess = forwardRef(function FormSuccess(
  { title, message, children, className, ...rest }: FormSuccessProps,
  ref: ForwardedRef<HTMLDivElement>,
): ReactElement {
  const headingId = useId();

  return (
    <div
      ref={ref}
      role="status"
      aria-labelledby={headingId}
      className={cx('form-success', className)}
      {...rest}
    >
      <span className="form-success__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>

      <h2 id={headingId} className="form-success__title">
        {title}
      </h2>

      {message != null && message !== false ? (
        <p className="form-success__message">{message}</p>
      ) : null}

      {children != null && children !== false ? (
        <div className="form-success__actions">{children}</div>
      ) : null}
    </div>
  );
});
