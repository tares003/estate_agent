'use client';

import {
  forwardRef,
  useId,
  type CSSProperties,
  type ForwardedRef,
  type HTMLAttributes,
  type ReactElement,
} from 'react';
import './Skeleton.css';

/** Placeholder shape. `text` renders one or more lines; `rect` / `circle`
 * render a single block. Defaults to `text`. */
export type SkeletonVariant = 'text' | 'rect' | 'circle';

/** A raw CSS dimension passed through to inline style. A bare number is treated
 * as pixels (React's default), mirroring the HTML `width`/`height` contract. */
export type SkeletonDimension = number | string;

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Placeholder shape. Defaults to `text`. */
  variant?: SkeletonVariant;
  /**
   * Number of placeholder lines for the `text` variant. Values below 1 are
   * clamped to 1. Ignored for `rect` / `circle`. Defaults to 1.
   */
  lines?: number;
  /**
   * Consumer-supplied width for the placeholder, applied verbatim as inline
   * style. The component's own intrinsic sizing is token-driven in
   * `Skeleton.css`; this prop only exists so a caller can mirror the real
   * layout (e.g. a 60%-wide heading) to avoid layout shift. For the `text`
   * variant it is applied to every line.
   */
  width?: SkeletonDimension;
  /**
   * Consumer-supplied height for the placeholder, applied verbatim as inline
   * style. As with `width`, the component's intrinsic sizing is token-driven;
   * this overrides it only when a caller needs to match a specific block.
   * Has no effect on the `text` variant (line height is token-driven).
   */
  height?: SkeletonDimension;
  /**
   * Accessible status text, rendered visually-hidden so the loading state is
   * announced (and conveyed by more than colour, G9). Defaults to `"Loading"`.
   * Pass `null` when the region is labelled externally (e.g. via
   * `aria-labelledby`) to avoid a doubled announcement.
   */
  label?: string | null;
}

/** Join class-name fragments, dropping any falsy ones. */
function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/**
 * Skeleton — the EPIC-L loading-placeholder atom (design canvas
 * `states/loading-skeleton-patterns.html`). Renders `aria-hidden` decorative
 * placeholders inside a `role="status"` / `aria-busy` region backed by
 * visually-hidden text, so assistive tech is told the surface is loading
 * (announced, not colour-only — G9). The pulse/shimmer is fully token-driven in
 * `Skeleton.css` (no raw hex / px / ms / easing — G7) and is switched off under
 * `prefers-reduced-motion`, holding a dimmed static state instead.
 *
 * The component's intrinsic dimensions come from tokens; the optional
 * `width` / `height` props let a caller mirror the real layout to keep CLS low,
 * and are the only place raw consumer-passed dimensions reach inline style.
 *
 * Viewport-invariant: it occupies whatever box the layout it stands in for
 * defines, so it carries no responsive breakpoints of its own.
 */
export const Skeleton = forwardRef(function Skeleton(
  {
    variant = 'text',
    lines = 1,
    width,
    height,
    label = 'Loading',
    className,
    ...rest
  }: SkeletonProps,
  ref: ForwardedRef<HTMLDivElement>,
): ReactElement {
  const labelId = useId();
  // `role="status"` does not derive its accessible name from descendant text,
  // so the visually-hidden label is wired via `aria-labelledby`. Rendered before
  // `...rest`, so a caller supplying their own `aria-labelledby` / `aria-label`
  // wins; passing `label={null}` drops the built-in text entirely.
  const hasOwnLabel = label != null;

  return (
    <div
      ref={ref}
      role="status"
      aria-busy="true"
      className={cx('skeleton', variant, className)}
      aria-labelledby={hasOwnLabel ? labelId : undefined}
      {...rest}
    >
      {variant === 'text' ? (
        <TextLines lines={lines} width={width} />
      ) : (
        <span className="skeleton-shape" aria-hidden="true" style={dimensionStyle(width, height)} />
      )}
      {hasOwnLabel ? (
        <span id={labelId} className="skeleton-vh">
          {label}
        </span>
      ) : null}
    </div>
  );
});

/** Build the inline style for a non-text shape, omitting any unset dimension so
 * the token-driven intrinsic size from the stylesheet remains in effect. */
function dimensionStyle(
  width: SkeletonDimension | undefined,
  height: SkeletonDimension | undefined,
): CSSProperties | undefined {
  if (width === undefined && height === undefined) return undefined;
  const style: CSSProperties = {};
  if (width !== undefined) style.width = width;
  if (height !== undefined) style.height = height;
  return style;
}

/** Render the placeholder lines for the `text` variant. A non-positive count is
 * clamped to a single line. */
function TextLines({
  lines,
  width,
}: {
  lines: number;
  width: SkeletonDimension | undefined;
}): ReactElement {
  const count = Math.max(1, Math.floor(lines));
  const lineStyle = width === undefined ? undefined : { width };
  return (
    <>
      {Array.from({ length: count }, (_unused, index) => (
        <span key={index} className="skeleton-line" aria-hidden="true" style={lineStyle} />
      ))}
    </>
  );
}
