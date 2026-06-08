import {
  forwardRef,
  useState,
  type ForwardedRef,
  type HTMLAttributes,
  type ReactElement,
} from 'react';
import './Avatar.css';

/** Diameter scale, mapping to the `--space-{8,12,16}` avatar box in the canvas. */
export type AvatarSize = 'sm' | 'md' | 'lg';

/** Frame shape. `circle` (default) uses `--radius-circle`; `square` rounds gently. */
export type AvatarShape = 'circle' | 'square';

export interface AvatarProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /**
   * The person's full name. Required: it is both the image `alt` text and the
   * accessible name of the initials fallback, and it is the source the initials
   * are derived from. Status/identity is therefore never image-only (G9).
   */
  name: string;
  /** Optional image URL. When absent or broken, an initials chip is shown. */
  src?: string;
  /** Diameter scale. Defaults to `md` (`--space-12`). */
  size?: AvatarSize;
  /** Frame shape. Defaults to `circle` (`--radius-circle`). */
  shape?: AvatarShape;
}

/** Join class-name fragments, dropping any falsy ones. */
function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/**
 * Derive up to two uppercase initials from a name: the first letter of the
 * first word and, when present, the first letter of the second word. Surplus
 * and repeated whitespace is ignored.
 */
function initialsFrom(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase();
}

/**
 * Avatar — the EPIC-L identity atom (team photos, testimonial and agent
 * avatars). Ported from `design/canvas/components/atoms/data-display.html`
 * (`.avatar` / `.avatar.sm` / `.avatar.lg`): a fixed-size square box at the
 * `--ratio-avatar` 1:1 ratio, fully token-driven via `Avatar.css` (G7).
 *
 * With a `src` it renders an `<img alt={name}>`. With no `src` — or when the
 * image fails to load — it renders an initials chip whose accessible name is
 * the full `name` (the visible initials are decorative), so the identity is
 * conveyed by more than an image (G9).
 */
export const Avatar = forwardRef(function Avatar(
  { name, src, size = 'md', shape = 'circle', className, ...rest }: AvatarProps,
  ref: ForwardedRef<HTMLSpanElement>,
): ReactElement {
  const [imageBroken, setImageBroken] = useState(false);
  const showImage = src != null && src !== '' && !imageBroken;

  return (
    <span ref={ref} className={cx('avatar', size, shape, className)} {...rest}>
      {showImage ? (
        <img
          className="image"
          src={src}
          alt={name}
          onError={() => {
            setImageBroken(true);
          }}
        />
      ) : (
        // The fallback is semantically an image of the person: `role="img"`
        // carries `name` as the accessible name (permitted on a role, unlike a
        // bare span), and the visible initials are decorative (`aria-hidden`).
        <span className="initials" role="img" aria-label={name}>
          <span aria-hidden="true">{initialsFrom(name)}</span>
        </span>
      )}
    </span>
  );
});
