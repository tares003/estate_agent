import {
  forwardRef,
  type ForwardedRef,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';
import './Badge.css';

/**
 * Badge tone. Two families, ported one-for-one from the EPIC-L data-display
 * canvas:
 *
 * - Semantic tones (`neutral` / `success` / `warning` / `danger` / `info`) map
 *   to `--colour-*` and render as a plain pill.
 * - Market-status tones map 1:1 to the `market_status` enum via
 *   `--colour-status-*` and render with a leading status dot, matching the
 *   canvas's `.badge.b-*` treatment.
 */
export type BadgeTone =
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'available'
  | 'under-offer'
  | 'sold-stc'
  | 'sold'
  | 'let-agreed'
  | 'let'
  | 'withdrawn';

/** Market-status tones get a leading dot per the canvas. */
const MARKET_STATUS_TONES: ReadonlySet<BadgeTone> = new Set<BadgeTone>([
  'available',
  'under-offer',
  'sold-stc',
  'sold',
  'let-agreed',
  'let',
  'withdrawn',
]);

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Status tone. Defaults to `neutral`. */
  tone?: BadgeTone;
  /**
   * Visible label. Status is NEVER conveyed by colour alone (G9): the text is
   * the primary signal, and screen-reader users get either this text or an
   * explicit `aria-label`.
   */
  children: ReactNode;
}

/** Join class-name fragments, dropping any falsy ones. */
function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/**
 * Badge — the EPIC-L status-pill atom. A non-interactive `<span>` with a
 * `--radius-pill` shape, fully token-driven via `Badge.css` (G7). Status is
 * conveyed by the visible text (and an optional `aria-label`), never by colour
 * alone (G9). Market-status tones render a leading decorative dot so the badge
 * reads as a status even at a glance.
 */
export const Badge = forwardRef(function Badge(
  { tone = 'neutral', className, children, ...rest }: BadgeProps,
  ref: ForwardedRef<HTMLSpanElement>,
): ReactElement {
  const hasDot = MARKET_STATUS_TONES.has(tone);

  return (
    <span ref={ref} className={cx('badge', tone, className)} {...rest}>
      {hasDot ? <span className="dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
});
