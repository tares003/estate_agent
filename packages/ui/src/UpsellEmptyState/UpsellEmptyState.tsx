import {
  forwardRef,
  useId,
  type AnchorHTMLAttributes,
  type ForwardedRef,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';
import { Button } from '../Button/Button.js';
import './UpsellEmptyState.css';

/**
 * Shared, CTA-agnostic props for the upsell empty state. The CTA shape itself
 * (link vs action) is layered on top via the {@link UpsellEmptyStateProps}
 * union so that at least one upgrade affordance is always provided.
 */
interface UpsellEmptyStateBaseProps extends Omit<
  HTMLAttributes<HTMLElement>,
  'title' | 'children'
> {
  /**
   * The pack this surface belongs to, in plain language (e.g. `"Sales-plus"`).
   * Rendered as an eyebrow above the title so the user learns which pack would
   * unlock the section (design-requirements §2a.1).
   */
  packName: ReactNode;
  /** Headline — what enabling the pack unlocks. Rendered as the region heading. */
  title: ReactNode;
  /** One-line plain-language description of what the pack enables. */
  description: ReactNode;
  /** Label for the upgrade CTA (e.g. `"Enable for £29 / month"`). */
  ctaLabel: ReactNode;
  /**
   * Optional decorative illustration / icon shown above the copy. Always hidden
   * from assistive technology (G9) — the meaning lives in the text.
   */
  icon?: ReactNode;
}

/**
 * Props for the upsell empty state. Exactly one upgrade affordance is required:
 *
 * - `ctaHref` — a navigational link (e.g. to the Plan & packs screen). Wins when
 *   both are supplied, since a real URL is the share-able, back-button-friendly
 *   affordance.
 * - `onCta` — an action callback (e.g. to open the pack-enable modal in place).
 */
export type UpsellEmptyStateProps = UpsellEmptyStateBaseProps &
  (
    | {
        /** Navigational CTA target. Renders a real `<a>` styled as a primary button. */
        ctaHref: string;
        /** Optional action callback; ignored when `ctaHref` is present. */
        onCta?: () => void;
        /** Forwarded to the rendered anchor (e.g. `target`, `rel`). */
        ctaProps?: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'className'>;
      }
    | {
        /** No link: render the Button atom as the CTA. */
        ctaHref?: undefined;
        /** Action callback fired on click / keyboard activation. */
        onCta: () => void;
        ctaProps?: never;
      }
  );

/** Join class-name fragments, dropping any falsy ones. */
function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/**
 * UpsellEmptyState — the EPIC-L "locked admin section" pattern
 * (design-requirements §2a.1). Shown in place of a pack-gated section when the
 * tenant's pack is OFF: never a 404 or a permission error, always a branded
 * upsell.
 *
 * Presentational and token-driven via `UpsellEmptyState.css` (G7). Accessible
 * by construction (G9): renders a labelled `role="region"` whose accessible
 * name comes from the heading via `aria-labelledby`, and the CTA is always a
 * real interactive element — the {@link Button} atom for the action variant, or
 * a primary-styled `<a>` for the navigational variant. The layout is a fluid
 * single column at every width, so responsive coverage is verified where it
 * composes into pages rather than here.
 */
export const UpsellEmptyState = forwardRef(function UpsellEmptyState(
  props: UpsellEmptyStateProps,
  ref: ForwardedRef<HTMLElement>,
): ReactElement {
  const {
    packName,
    title,
    description,
    ctaLabel,
    icon,
    ctaHref,
    onCta,
    ctaProps,
    className,
    ...rest
  } = props;

  const headingId = useId();

  return (
    // A named <section> exposes the implicit `region` role to the a11y tree;
    // the accessible name comes from the heading via `aria-labelledby` (G9). No
    // explicit role is needed (jsx-a11y/no-redundant-roles).
    <section
      ref={ref}
      aria-labelledby={headingId}
      className={cx('upsell-empty', className)}
      {...rest}
    >
      {icon != null && icon !== false ? (
        <div className="upsell-empty__icon" aria-hidden="true">
          {icon}
        </div>
      ) : null}

      <p className="upsell-empty__pack">{packName}</p>

      <h2 id={headingId} className="upsell-empty__title">
        {title}
      </h2>

      <p className="upsell-empty__desc">{description}</p>

      <div className="upsell-empty__cta">
        {ctaHref != null ? (
          // Navigational CTA: a real link carrying the Button atom's visual
          // contract so it reads as a primary CTA without a nested button.
          <a className="btn primary md" href={ctaHref} {...ctaProps}>
            {ctaLabel}
          </a>
        ) : (
          <Button variant="primary" onClick={onCta}>
            {ctaLabel}
          </Button>
        )}
      </div>
    </section>
  );
});
