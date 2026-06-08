import {
  forwardRef,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type ForwardedRef,
  type HTMLAttributes,
  type ReactElement,
} from 'react';
import './PackLockPill.css';

/** Height/padding scale. Defaults to `md`. */
export type PackLockPillSize = 'sm' | 'md';

/**
 * Attributes that apply regardless of which element the pill renders as. The
 * element-specific props (`href`, `onClick`) are layered on top per-mode below.
 */
interface PackLockPillBaseProps {
  /**
   * Name of the feature pack this element is gated behind, e.g. `"Sales-plus"`.
   * Rendered as the visible label, and woven into the default accessible name.
   */
  packName: string;
  /** Height/padding scale. Defaults to `md`. */
  size?: PackLockPillSize;
  /**
   * Destination of the upgrade path. When supplied, the pill renders as an
   * anchor (`<a>`) so it behaves as a real link.
   */
  href?: string;
  /** Extra class names, merged after the base/size classes. */
  className?: string;
}

export type PackLockPillProps = PackLockPillBaseProps &
  // Allow the consumer to pass through native attributes for whichever element
  // this resolves to (span / button / anchor), without losing type-safety on
  // the shared props above.
  Omit<HTMLAttributes<HTMLElement>, keyof PackLockPillBaseProps> &
  Pick<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'disabled'> &
  Pick<AnchorHTMLAttributes<HTMLAnchorElement>, 'target' | 'rel'>;

/** Join class-name fragments, dropping any falsy ones. */
function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/**
 * Decorative padlock glyph, ported from the EPIC-L pack-state canvas
 * (`design/canvas/components/modular/pack-state.html`). Sized in `em` so it
 * tracks the pill's font-size; marked `aria-hidden` so the locked state is
 * carried by the accessible name, never by the icon alone (G9).
 */
function LockGlyph(): ReactElement {
  return (
    <svg
      className="ico"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
      focusable="false"
    >
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/**
 * PackLockPill — the EPIC-L pack-state atom. A small inline pill that marks a
 * feature as locked behind a feature pack (PRODUCT.md §5a).
 *
 * Presentational only: it does NOT import `@estate/entitlement` — deciding
 * whether a pack is enabled (and therefore whether to render this pill at all)
 * is the consumer's job. Here we only render the lock affordance and, if given
 * an upgrade path, make it actionable.
 *
 * Renders a decorative lock glyph plus the pack name. The accessible name
 * conveys "requires upgrade" so the locked meaning survives without the icon
 * (G9): by default it is `"<packName> — requires upgrade"`, overridable via an
 * explicit `aria-label`. Fully token-driven via `PackLockPill.css` (G7).
 *
 * Element resolution:
 * - `href` given → `<a>` to the upgrade path (still fires `onClick` if both).
 * - `onClick` given (no `href`) → `<button type="button">`.
 * - neither → a non-interactive `<span>`.
 */
export const PackLockPill = forwardRef(function PackLockPill(
  {
    packName,
    size = 'md',
    href,
    onClick,
    className,
    'aria-label': ariaLabel,
    ...rest
  }: PackLockPillProps,
  ref: ForwardedRef<HTMLElement>,
): ReactElement {
  // The locked state is conveyed in text, never by the (decorative) icon alone.
  const accessibleName = ariaLabel ?? `${packName} — requires upgrade`;
  const classes = cx('lockpill', size, className);
  const body = (
    <>
      <LockGlyph />
      <span className="nm">{packName}</span>
    </>
  );

  if (href !== undefined) {
    return (
      <a
        ref={ref as ForwardedRef<HTMLAnchorElement>}
        className={classes}
        href={href}
        aria-label={accessibleName}
        onClick={onClick}
        {...rest}
      >
        {body}
      </a>
    );
  }

  if (onClick !== undefined) {
    return (
      <button
        ref={ref as ForwardedRef<HTMLButtonElement>}
        type="button"
        className={classes}
        aria-label={accessibleName}
        onClick={onClick}
        {...rest}
      >
        {body}
      </button>
    );
  }

  return (
    <span
      ref={ref as ForwardedRef<HTMLSpanElement>}
      className={classes}
      aria-label={accessibleName}
      {...rest}
    >
      {body}
    </span>
  );
});
