import {
  forwardRef,
  useId,
  type ForwardedRef,
  type HTMLAttributes,
  type ReactElement,
} from 'react';
import './Spinner.css';

/** Diameter scale, mapping to `--size-icon-{sm,md,lg}`. */
export type SpinnerSize = 'sm' | 'md' | 'lg';

export interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  /** Diameter scale. Defaults to `md` (`--size-icon-md`). */
  size?: SpinnerSize;
  /**
   * Accessible status text, rendered visually-hidden so the loading state is
   * conveyed by more than colour (G9). Defaults to `"Loading"`. Pass `null`
   * when the spinner is labelled externally (e.g. via `aria-labelledby`) to
   * avoid a doubled announcement.
   */
  label?: string | null;
}

/** Join class-name fragments, dropping any falsy ones. */
function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/**
 * Spinner — the EPIC-L loading-indicator atom. Renders a `role="status"`
 * live region with a visually-hidden text label (so the state is announced and
 * not colour-only, G9). The rotating ring is fully token-driven via
 * `Spinner.css` (G7) and stops spinning under `prefers-reduced-motion`. A
 * fixed-height fluid-width atom: it occupies its `--size-icon-*` box and does
 * not change with the viewport.
 */
export const Spinner = forwardRef(function Spinner(
  { size = 'md', label = 'Loading', className, children, ...rest }: SpinnerProps,
  ref: ForwardedRef<HTMLSpanElement>,
): ReactElement {
  const labelId = useId();
  // `role="status"` does not derive its accessible name from descendant text,
  // so the visually-hidden label is wired up via `aria-labelledby`. The default
  // is rendered before `...rest`, so a caller who supplies their own
  // `aria-labelledby` / `aria-label` wins. When `label` is omitted there is no
  // built-in text, leaving the caller's labelling as the sole name source.
  const hasOwnLabel = label != null;

  return (
    <span
      ref={ref}
      role="status"
      className={cx('spinner', size, className)}
      aria-labelledby={hasOwnLabel ? labelId : undefined}
      {...rest}
    >
      <span className="ring" aria-hidden="true" />
      {hasOwnLabel ? (
        <span id={labelId} className="vh">
          {label}
        </span>
      ) : null}
      {children}
    </span>
  );
});
