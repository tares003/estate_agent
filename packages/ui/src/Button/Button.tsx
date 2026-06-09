import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ForwardedRef,
  type ReactElement,
  type ReactNode,
} from 'react';
import './Button.css';

/** Visual variants, ported one-for-one from the EPIC-L Button canvas. */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'link';

/** Heights — `md` (44px, `--size-button-md`) meets the touch-target minimum. */
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual variant. Defaults to `primary`. */
  variant?: ButtonVariant;
  /** Height/padding scale. Defaults to `md` (44px touch target). */
  size?: ButtonSize;
  /**
   * Shows a centred spinner, sets `aria-busy`, and disables interaction. While
   * loading, the label and any icons are visually replaced by the spinner.
   */
  loading?: boolean;
  /** Decorative icon rendered before the label. Hidden while loading. */
  leftIcon?: ReactNode;
  /** Decorative icon rendered after the label. Hidden while loading. */
  rightIcon?: ReactNode;
  /** Button label. */
  children?: ReactNode;
}

/** Join class-name fragments, dropping any falsy ones. */
function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/**
 * The `btn` class string for a given variant/size — the same classes `Button`
 * renders. Use it to style a real link (a CTA that navigates) as a button:
 * `<Link className={buttonClassName({ variant: 'primary', size: 'lg' })}>` — an
 * anchor is the correct element for navigation (a `<button>` does nothing without
 * an `onClick`), and `.btn` is element-agnostic so the styling is identical.
 */
export function buttonClassName(
  options: { variant?: ButtonVariant; size?: ButtonSize; loading?: boolean } = {},
): string {
  const { variant = 'primary', size = 'md', loading = false } = options;
  return cx('btn', variant, size, loading && 'loading');
}

/**
 * Button — the first-party EPIC-L atom. Renders a real `<button>`, is fully
 * token-driven via `Button.css` (G7), and is keyboard- and touch-accessible
 * (G9): focus ring comes from `base.css`, disabled uses the native attribute,
 * and the loading state is announced with `aria-busy`.
 */
export const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    type = 'button',
    loading = false,
    disabled = false,
    leftIcon,
    rightIcon,
    className,
    children,
    ...rest
  }: ButtonProps,
  ref: ForwardedRef<HTMLButtonElement>,
): ReactElement {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      type={type}
      className={cx(buttonClassName({ variant, size, loading }), className)}
      disabled={isDisabled}
      aria-busy={loading}
      {...rest}
    >
      {!loading && leftIcon ? (
        <span className="ico" aria-hidden="true">
          {leftIcon}
        </span>
      ) : null}
      {children}
      {!loading && rightIcon ? (
        <span className="ico" aria-hidden="true">
          {rightIcon}
        </span>
      ) : null}
      {loading ? <span className="spinner" aria-hidden="true" /> : null}
    </button>
  );
});
